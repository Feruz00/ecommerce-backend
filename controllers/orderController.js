"use strict";

const { Op, Transaction } = require("sequelize");
const {
  Order,
  OrderItem,
  CartItem,
  Product,
  Payment,
  User,
  Notification,
  sequelize,
  ProductVariant,
} = require("../models");

const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const { v4: uuidv4 } = require("uuid");

const genNo = () => {
  const d = new Date();

  return `ORD${d.getFullYear().toString().slice(-2)}${String(
    d.getMonth() + 1,
  ).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}${Math.floor(
    Math.random() * 9000 + 1000,
  )}`;
};

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const getVariantId = (item) => {
  return item.variant_id || item.selected_attributes?.variant_id || null;
};

const getProductName = (product) => {
  return (
    product?.translations?.en?.name ||
    product?.translations?.ru?.name ||
    product?.translations?.tm?.name ||
    product?.name ||
    product?.sku ||
    "Product"
  );
};

const getVariantStockField = (variant) => {
  const attributes = variant.constructor.rawAttributes || {};

  return ["quantity", "stock", "stock_quantity"].find(
    (field) => attributes[field],
  );
};

const getVariantPrice = (variant, product) => {
  const variantPrice = variant?.price;

  if (
    variantPrice !== undefined &&
    variantPrice !== null &&
    variantPrice !== ""
  ) {
    return toNumber(variantPrice);
  }

  return toNumber(product.price);
};

const getVariantSku = (variant, product) => {
  return variant?.sku || variant?.variant_sku || product?.sku || null;
};

exports.checkout = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const body = req.body || {};
  const address = body.shipping_address || body;

  const { full_name, phone, city, district, street } = address;

  const payment_method = body.payment_method || "cash";
  const note = body.note || body.notes || null;

  if (!full_name || !phone || !city || !street) {
    return next(new AppError("Shipping address is incomplete", 400));
  }

  if (!["cash", "card"].includes(payment_method)) {
    return next(new AppError("Invalid payment method", 400));
  }

  // All prices and stock are calculated on the server.
  // Never accept product prices or totals from the client.
  const result = await sequelize.transaction(
    {
      isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED,
    },
    async (transaction) => {
      const cartItems = await CartItem.findAll({
        where: { user_id: userId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!cartItems.length) {
        throw new AppError("Cart is empty", 400);
      }

      const preparedItems = [];

      for (const cartItem of cartItems) {
        const quantity = Number(cartItem.quantity);

        if (!Number.isInteger(quantity) || quantity < 1) {
          throw new AppError("Invalid cart quantity", 400);
        }

        const product = await Product.findByPk(cartItem.product_id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!product || !product.is_active) {
          throw new AppError("One or more products are unavailable", 400);
        }

        const variantId = getVariantId(cartItem);

        let variant = null;
        let price;
        let sku;
        let selectedAttributes = null;

        if (variantId) {
          // ------------------------------------------
          // Variant product
          // ------------------------------------------

          variant = await ProductVariant.findByPk(variantId, {
            transaction,
            lock: transaction.LOCK.UPDATE,
            include: [
              {
                model: VariantAttributeValue,
                as: "attributeValues",
                include: [
                  {
                    model: Attribute,
                    as: "attribute",
                  },
                  {
                    model: AttributeOption,
                    as: "option",
                  },
                ],
              },
            ],
          });

          if (
            !variant ||
            String(variant.product_id) !== String(product.id) ||
            !variant.is_active
          ) {
            throw new AppError("Selected product variant is unavailable", 400);
          }

          if (Number(variant.quantity) < quantity) {
            throw new AppError(
              `Insufficient stock for ${getProductName(product)} (${variant.sku})`,
              400,
            );
          }

          price = getVariantPrice(variant, product);
          sku = variant.sku || product.sku;

          // Save readable values from the database, not IDs.
          selectedAttributes = buildVariantSnapshot(variant, cartItem);
        } else {
          // ------------------------------------------
          // Product without a selected variant
          // ------------------------------------------

          // If the product has variants, selecting one is mandatory.
          const variantCount = await ProductVariant.count({
            where: {
              product_id: product.id,
              is_active: true,
            },
            transaction,
          });

          if (variantCount > 0) {
            throw new AppError(
              `Please select a variant for ${getProductName(product)}`,
              400,
            );
          }

          if (Number(product.quantity) < quantity) {
            throw new AppError(
              `Insufficient stock for ${getProductName(product)}`,
              400,
            );
          }

          price = Number(product.price);
          sku = product.sku;
        }

        if (!Number.isFinite(price) || price < 0) {
          throw new AppError("Invalid product price", 400);
        }

        const unitPriceCents = toCents(price);
        const lineTotalCents = unitPriceCents * quantity;

        preparedItems.push({
          product,
          variant,
          variantId,
          quantity,
          sku,
          priceCents: unitPriceCents,
          totalCents: lineTotalCents,
          selectedAttributes,
        });
      }

      // --------------------------------------------
      // Calculate totals using integer cents
      // --------------------------------------------

      const subtotalCents = preparedItems.reduce(
        (sum, item) => sum + item.totalCents,
        0,
      );

      // Keep your existing shipping rule.
      const shippingCents = subtotalCents > 50000 ? 0 : 2000;

      const discountCents = 0;

      const totalCents = subtotalCents + shippingCents - discountCents;

      // --------------------------------------------
      // Create order
      // --------------------------------------------

      const order = await Order.create(
        {
          order_number: genNo(),
          user_id: userId,
          status: "pending",
          payment_status: "pending",
          payment_method,

          subtotal: fromCents(subtotalCents),
          shipping_cost: fromCents(shippingCents),
          discount: fromCents(discountCents),
          total: fromCents(totalCents),

          note,

          shipping_address: {
            full_name: full_name.trim(),
            phone: phone.trim(),
            city: city.trim(),
            district: district?.trim() || null,
            street: street.trim(),
          },
        },
        { transaction },
      );

      // --------------------------------------------
      // Save one OrderItem for every cart line
      // --------------------------------------------

      await OrderItem.bulkCreate(
        preparedItems.map((item) => ({
          order_id: order.id,
          product_id: item.product.id,
          variant_id: item.variantId,

          product_name: getProductName(item.product),
          product_sku: item.sku,

          price: fromCents(item.priceCents),
          quantity: item.quantity,
          total: fromCents(item.totalCents),

          selected_attributes: item.selectedAttributes,
        })),
        { transaction },
      );

      // --------------------------------------------
      // Decrease correct inventory
      // --------------------------------------------

      for (const item of preparedItems) {
        if (item.variant) {
          // Variant order: decrease variant stock only.
          await item.variant.decrement("quantity", {
            by: item.quantity,
            transaction,
          });
        } else {
          // Standard product: decrease product stock.
          await item.product.decrement("quantity", {
            by: item.quantity,
            transaction,
          });
        }

        if (item.product.constructor.rawAttributes.sold_count) {
          await item.product.increment("sold_count", {
            by: item.quantity,
            transaction,
          });
        }
      }

      // --------------------------------------------
      // Payment
      // --------------------------------------------

      await Payment.create(
        {
          order_id: order.id,
          amount: fromCents(totalCents),
          method: payment_method,
          status: "pending",
        },
        { transaction },
      );

      // --------------------------------------------
      // Clear cart
      // --------------------------------------------

      await CartItem.destroy({
        where: { user_id: userId },
        transaction,
      });

      return {
        orderId: order.id,
        orderNumber: order.order_number,
        total: fromCents(totalCents),
      };
    },
  );

  // ------------------------------------------------
  // Notifications after successful transaction
  // ------------------------------------------------

  const admins = await User.findAll({
    where: {
      role: { [Op.in]: ["admin", "manager"] },
      status: "active",
    },
  });

  if (admins.length) {
    await Notification.bulkCreate(
      admins.map((admin) => ({
        id: uuidv4(),
        user_id: admin.id,
        type: "order_new",
        title: "New Order",
        message: `Order #${result.orderNumber} — ${result.total} TMT`,
        data: {
          orderId: result.orderId,
          orderNumber: result.orderNumber,
        },
      })),
    );
  }

  const io = req.app.get("io");

  if (io) {
    io.to("admins").emit("new_order", {
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      total: result.total,
      customer: {
        name: `${req.user.first_name || ""} ${req.user.last_name || ""}`.trim(),
      },
    });
  }

  // Return complete order with its item snapshots.
  const full = await Order.findByPk(result.orderId, {
    include: [
      {
        model: OrderItem,
        as: "items",
      },
      {
        model: Payment,
        as: "payments",
      },
    ],
  });

  res.status(201).json({
    status: "success",
    data: {
      order: full,
    },
  });
});

exports.myOrders = catchAsync(async (req, res) => {
  const orders = await Order.findAll({
    where: { user_id: req.user.id },
    include: [
      { model: OrderItem, as: "items" },
      { model: Payment, as: "payments" },
    ],
    order: [["created_at", "DESC"]],
  });

  res.json({
    status: "success",
    data: { orders },
  });
});

exports.getAll = catchAsync(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

  const where = req.query.status ? { status: req.query.status } : {};

  const { count, rows } = await Order.findAndCountAll({
    where,
    distinct: true,
    include: [
      {
        model: User,
        as: "user",
        attributes: [
          "id",
          "first_name",
          "last_name",
          "username",
          "phone",
          "username",
        ],
      },
      { model: OrderItem, as: "items" },
    ],
    limit,
    offset: (page - 1) * limit,
    order: [["created_at", "DESC"]],
  });

  res.json({
    status: "success",
    total: count,
    page,
    limit,
    data: { orders: rows },
  });
});

exports.getOne = catchAsync(async (req, res, next) => {
  const order = await Order.findByPk(req.params.id, {
    include: [
      {
        model: User,
        as: "user",
        attributes: [
          "id",
          "first_name",
          "last_name",
          "username",
          "phone",
          "username",
        ],
      },
      { model: OrderItem, as: "items" },
      { model: Payment, as: "payments" },
    ],
  });

  if (!order) {
    return next(new AppError("Order not found", 404));
  }

  if (
    req.user.role === "customer" &&
    String(order.user_id) !== String(req.user.id)
  ) {
    return next(new AppError("Forbidden", 403));
  }

  res.json({
    status: "success",
    data: { order },
  });
});

exports.updateStatus = catchAsync(async (req, res, next) => {
  const order = await Order.findByPk(req.params.id);

  if (!order) {
    return next(new AppError("Order not found", 404));
  }

  const allowedStatuses = [
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
  ];

  const allowedPaymentStatuses = ["pending", "paid", "failed", "refunded"];

  if (
    req.body.status !== undefined &&
    !allowedStatuses.includes(req.body.status)
  ) {
    return next(new AppError("Invalid order status", 400));
  }

  if (
    req.body.payment_status !== undefined &&
    !allowedPaymentStatuses.includes(req.body.payment_status)
  ) {
    return next(new AppError("Invalid payment status", 400));
  }

  if (req.body.status !== undefined) {
    order.status = req.body.status;
  }

  if (req.body.payment_status !== undefined) {
    order.payment_status = req.body.payment_status;
  }

  if (req.body.note !== undefined) {
    order.note = req.body.note;
  }

  await order.save();

  res.json({
    status: "success",
    data: { order },
  });
});
