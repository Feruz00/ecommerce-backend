const { Op } = require("sequelize");

const { Order, Product, User, Notification, sequelize } = require("../models");

const catchAsync = require("../utils/catchAsync");

const LOW_STOCK_LIMIT = 5;
const RECENT_ORDERS_LIMIT = 8;
const LOW_STOCK_LIMIT_COUNT = 10;

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const getCustomerName = (order) => {
  const user = order.user;

  if (user) {
    const fullName = [user.first_name, user.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();

    if (fullName) return fullName;
    if (user.username) return user.username;
  }

  const address = order.shipping_address;

  if (address && typeof address === "object") {
    return (
      address.full_name ||
      address.name ||
      address.first_name ||
      "Guest customer"
    );
  }

  return "Guest customer";
};

const getProductName = (product, locale = "en") => {
  if (!product) return "Unknown product";

  let translations = product.translations;

  // Support JSON strings as well as Sequelize JSON objects.
  if (typeof translations === "string") {
    try {
      translations = JSON.parse(translations);
    } catch {
      translations = {};
    }
  }

  return (
    translations?.[locale]?.name ||
    translations?.en?.name ||
    translations?.tm?.name ||
    translations?.ru?.name ||
    product.sku ||
    "Unnamed product"
  );
};

exports.dashboard = catchAsync(async (req, res) => {
  const [
    customersCount,
    productsCount,
    ordersCount,
    revenueRow,
    recentOrders,
    lowStockProducts,
  ] = await Promise.all([
    User.count({
      where: {
        role: "customer",
      },
    }),

    Product.count({
      where: {
        is_active: true,
      },
    }),

    Order.count(),

    // Only paid orders count as actual revenue.
    Order.findOne({
      attributes: [
        [
          sequelize.fn(
            "COALESCE",
            sequelize.fn("SUM", sequelize.col("Order.total")),
            0,
          ),
          "revenue",
        ],
      ],
      where: {
        // status: "paid",
        status: {
          [Op.ne]: "cancelled",
        },
      },
      raw: true,
    }),

    Order.findAll({
      attributes: [
        "id",
        "order_number",
        "user_id",
        "status",
        // "payment_status",
        "payment_method",
        "total",
        "created_at",
        "shipping_address",
      ],
      limit: RECENT_ORDERS_LIMIT,
      order: [["created_at", "DESC"]],
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "first_name", "last_name", "username"],
          required: false,
        },
      ],
    }),

    Product.findAll({
      attributes: ["id", "sku", "translations", "quantity"],
      where: {
        quantity: {
          [Op.lte]: LOW_STOCK_LIMIT,
        },
        is_active: true,
      },
      limit: LOW_STOCK_LIMIT_COUNT,
      order: [
        ["quantity", "ASC"],
        ["created_at", "DESC"],
      ],
    }),
  ]);

  const revenue = toNumber(revenueRow?.revenue);

  const formattedRecentOrders = recentOrders.map((order) => {
    const item = order.toJSON();

    return {
      ...item,
      customer_name: getCustomerName(item),
      total: toNumber(item.total),
    };
  });

  const formattedLowStock = lowStockProducts.map((product) => {
    const item = product.toJSON();

    return {
      ...item,
      name: getProductName(item, req.locale || "en"),
      quantity: toNumber(item.quantity),
    };
  });

  res.status(200).json({
    status: "success",
    data: {
      stats: {
        customers: customersCount,
        products: productsCount,
        orders: ordersCount,
        revenue,
      },
      recentOrders: formattedRecentOrders,
      lowStock: formattedLowStock,
      lowStockLimit: LOW_STOCK_LIMIT,
    },
  });
});

exports.notifications = catchAsync(async (req, res) => {
  const userId = req.user.id;

  const [notifications, unreadCount] = await Promise.all([
    Notification.findAll({
      where: {
        user_id: userId,
      },
      order: [
        ["created_at", "DESC"],
        ["id", "DESC"],
      ],
      limit: 30,
    }),

    Notification.count({
      where: {
        user_id: userId,
        is_read: false,
      },
    }),
  ]);

  res.status(200).json({
    status: "success",
    data: {
      notifications,
      unreadCount,
    },
  });
});

exports.markNotificationRead = catchAsync(async (req, res) => {
  const [updatedCount] = await Notification.update(
    {
      is_read: true,
    },
    {
      where: {
        id: req.params.id,
        user_id: req.user.id,
        is_read: false,
      },
    },
  );

  // Check whether the notification belongs to this user.
  if (!updatedCount) {
    const notification = await Notification.findOne({
      where: {
        id: req.params.id,
        user_id: req.user.id,
      },
    });

    if (!notification) {
      return res.status(404).json({
        status: "fail",
        message: "Notification not found",
      });
    }
  }

  res.status(200).json({
    status: "success",
    message: "Notification marked as read",
  });
});
