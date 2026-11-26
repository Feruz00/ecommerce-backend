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
  VariantAttributeValue,
  Attribute,
  AttributeOption,
} = require("../models");

const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const { v4: uuidv4 } = require("uuid");
const { getIO } = require("../socket");
const ORDER_STATUSES = ["confirmed", "processing", "delivered", "cancelled"];
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

/** Money helpers – work in integer cents to avoid floating-point errors */
const toCents = (value) => Math.round(toNumber(value) * 100);
const fromCents = (cents) => Number((toNumber(cents) / 100).toFixed(2));

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

/**
 * Build a durable, human-readable snapshot of the chosen variant attributes.
 * Stored on OrderItem so admin/history still shows the correct size/color
 * even if the catalog later changes.
 */
function buildVariantSnapshot(variant, cartItem) {
  // Prefer labels the frontend already sent (readable strings).
  const fromCart = cartItem?.selected_attributes;
  if (
    fromCart &&
    typeof fromCart === "object" &&
    Object.keys(fromCart).length
  ) {
    const snap = { ...fromCart };
    if (variant?.id && !snap.variant_id) snap.variant_id = variant.id;
    return snap;
  }

  const snapshot = {};
  if (variant?.id) snapshot.variant_id = variant.id;

  const entries =
    variant?.attributeValues || variant?.attributes || variant?.options || [];

  for (const entry of entries) {
    const code =
      entry?.attribute?.code ||
      entry?.definition?.code ||
      entry?.code ||
      entry?.attribute_code;

    if (!code) continue;

    const label =
      entry?.option?.translations?.en?.name ||
      entry?.option?.translations?.ru?.name ||
      entry?.option?.translations?.tm?.name ||
      entry?.option?.name ||
      entry?.option?.label ||
      entry?.option?.value ||
      entry?.value_text ||
      entry?.display ||
      entry?.value ||
      null;

    if (label !== null && label !== undefined && label !== "") {
      snapshot[code] = String(label);
    }
  }

  return snapshot;
}

exports.checkout = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const body = req.body || {};
  const address = body.shipping_address || body;

  const { full_name, phone, city, district, street } = address;

  const delivery_method = body.delivery_method || "delivery";
  const payment_method = body.payment_method || "cash";
  const note = body.note || body.notes || null;

  if (!["delivery", "pickup"].includes(delivery_method)) {
    return next(new AppError("Invalid delivery method", 400));
  }

  if (!full_name || !phone) {
    return next(new AppError("Customer name and phone are required", 400));
  }
  if (delivery_method === "delivery" && (!city || !street)) {
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
                required: false,
                include: [
                  { model: Attribute, as: "attribute", required: false },
                  { model: AttributeOption, as: "option", required: false },
                ],
              },
            ],
          });

          if (
            !variant ||
            String(variant.product_id) !== String(product.id) ||
            variant.is_active === false
          ) {
            throw new AppError("Selected product variant is unavailable", 400);
          }

          if (Number(variant.quantity) < quantity) {
            throw new AppError(
              `Insufficient stock for ${getProductName(product)} (${variant.sku || variantId})`,
              400,
            );
          }

          price = getVariantPrice(variant, product);
          sku = getVariantSku(variant, product);
          selectedAttributes = buildVariantSnapshot(variant, cartItem);
        } else {
          // ------------------------------------------
          // Product without a selected variant
          // ------------------------------------------
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

          price = toNumber(product.price);
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

      // Free shipping over 500 TMT (50000 cents)
      const shippingCents =
        delivery_method === "pickup" ? 0 : subtotalCents > 50000 ? 0 : 2000;
      const discountCents = 0;
      const totalCents = subtotalCents + shippingCents - discountCents;

      // --------------------------------------------
      // Create order
      // --------------------------------------------
      const order = await Order.create(
        {
          order_number: genNo(),
          user_id: userId,
          status: "processing",

          delivery_method,
          payment_method,

          subtotal: fromCents(subtotalCents),
          shipping_cost: fromCents(shippingCents),
          discount: fromCents(discountCents),
          total: fromCents(totalCents),

          note,

          shipping_address: {
            full_name: full_name.trim(),
            phone: phone.trim(),

            ...(delivery_method === "delivery"
              ? {
                  city: city.trim(),
                  district: district?.trim() || null,
                  street: street.trim(),
                }
              : {}),
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
          await item.variant.decrement("quantity", {
            by: item.quantity,
            transaction,
          });
        } else {
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
      role: {
        [Op.in]: ["admin", "manager"],
      },
      status: "active",
    },
    attributes: ["id"],
  });

  const notifications = admins.map((admin) => ({
    id: uuidv4(),
    user_id: admin.id,
    type: "order_new",
    title: "New Order",
    message: `Order #${result.orderNumber} — ${result.total} TMT`,
    data: {
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      total: result.total,
    },
    is_read: false,
  }));

  let createdNotifications = [];

  if (notifications.length) {
    createdNotifications = await Notification.bulkCreate(notifications);
  }

  const io = getIO();
  if (io) {
    const payload = {
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      total: result.total,
      customer: {
        name: `${req.user.first_name || ""} ${req.user.last_name || ""}`.trim(),
      },
    };

    // Update orders page and dashboard.
    io.to("admins").emit("new_order", payload);

    // Update notification bell and notification list.
    for (const notification of createdNotifications) {
      io.to("admins").emit("new_notification", {
        id: notification.id,
        userId: notification.user_id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        is_read: notification.is_read,
        created_at: notification.created_at,
      });
    }
  }

  // Return complete order with its item snapshots.
  const full = await Order.findByPk(result.orderId, {
    include: [
      { model: OrderItem, as: "items" },
      { model: Payment, as: "payments" },
    ],
  });

  res.status(201).json({
    status: "success",
    data: {
      order: full,
    },
  });
});

exports.myOrders = catchAsync(async (req, res, next) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

  const where = {
    user_id: req.user.id,
  };

  if (req.query.status && req.query.status !== "all") {
    if (!ORDER_STATUSES.includes(req.query.status)) {
      return next(new AppError("Invalid order status", 400));
    }

    where.status = req.query.status;
  }

  const { count, rows } = await Order.findAndCountAll({
    where,
    include: [
      { model: OrderItem, as: "items" },
      { model: Payment, as: "payments" },
    ],
    distinct: true,
    limit,
    offset: (page - 1) * limit,
    order: [["created_at", "DESC"]],
  });

  res.json({
    status: "success",
    data: {
      orders: rows,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    },
  });
});

exports.getAll = catchAsync(async (req, res, next) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

  const where = {};

  if (req.query.status && req.query.status !== "all") {
    if (!ORDER_STATUSES.includes(req.query.status)) {
      return next(new AppError("Invalid order status", 400));
    }

    where.status = req.query.status;
  }

  const { count, rows } = await Order.findAndCountAll({
    where,
    distinct: true,
    include: [
      {
        model: User,
        as: "user",
        attributes: ["id", "first_name", "last_name", "username", "phone"],
      },
      {
        model: OrderItem,
        as: "items",
      },
      {
        model: Payment,
        as: "payments",
        attributes: ["id", "amount", "method", "status"],
      },
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
    data: {
      orders: rows,
    },
  });
});

exports.getOne = catchAsync(async (req, res, next) => {
  const order = await Order.findByPk(req.params.id, {
    include: [
      {
        model: User,
        as: "user",
        attributes: ["id", "first_name", "last_name", "username", "phone"],
      },
      { model: OrderItem, as: "items" },
      { model: Payment, as: "payments" },
    ],
  });

  if (!order) {
    return next(new AppError("Order not found", 404));
  }

  // Customers can only access their own orders.
  if (
    req.user.role === "customer" &&
    String(order.user_id) !== String(req.user.id)
  ) {
    return next(new AppError("Order not found", 404));
  }

  res.json({
    status: "success",
    data: { order },
  });
});

exports.updateStatus = catchAsync(async (req, res, next) => {
  const { status } = req.body;

  const ORDER_STATUSES = ["processing", "confirmed", "delivered", "cancelled"];

  if (!ORDER_STATUSES.includes(status)) {
    return next(new AppError("Invalid order status", 400));
  }

  const transaction = await sequelize.transaction();

  try {
    const order = await Order.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!order) {
      await transaction.rollback();
      return next(new AppError("Order not found", 404));
    }

    // Delivered and cancelled orders are final.
    if (["delivered", "cancelled"].includes(order.status)) {
      await transaction.rollback();

      return next(
        new AppError(
          `Cannot update an order with status "${order.status}"`,
          400,
        ),
      );
    }

    // Prevent unnecessary updates.
    if (order.status === status) {
      await transaction.rollback();

      return next(new AppError("Order already has this status", 400));
    }

    order.status = status;
    await order.save({ transaction });

    // Delivered means payment was successfully received.
    if (status === "delivered") {
      await Payment.update(
        {
          status: "completed",
          paid_at: new Date(),
        },
        {
          where: {
            order_id: order.id,
            status: "pending",
          },
          transaction,
        },
      );
    }

    await transaction.commit();

    res.status(200).json({
      status: "success",
      message: "Order status updated successfully",
      data: { order },
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    throw error;
  }
});
