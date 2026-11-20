const { Op } = require("sequelize");
const {
  Order,
  OrderItem,
  Product,
  User,
  Notification,
  sequelize,
} = require("../models");
const catchAsync = require("../utils/catchAsync");

exports.dashboard = catchAsync(async (req, res) => {
  const [
    usersCount,
    productsCount,
    ordersCount,
    revenueRow,
    recentOrders,
    lowStock,
  ] = await Promise.all([
    User.count({ where: { role: "customer" } }),
    Product.count({ where: { is_active: true } }),
    Order.count(),
    Order.findOne({
      attributes: [
        [
          sequelize.fn(
            "COALESCE",
            sequelize.fn("SUM", sequelize.col("total")),
            0,
          ),
          "revenue",
        ],
      ],
      where: {
        payment_status: { [Op.in]: ["paid", "pending"] },
        status: { [Op.ne]: "cancelled" },
      },
      raw: true,
    }),
    Order.findAll({
      limit: 8,
      order: [["created_at", "DESC"]],
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "first_name", "last_name", "username"],
        },
      ],
    }),
    Product.findAll({
      where: { quantity: { [Op.lte]: 5 }, is_active: true },
      limit: 10,
      order: [["quantity", "ASC"]],
    }),
  ]);

  res.json({
    status: "success",
    data: {
      stats: {
        customers: usersCount,
        products: productsCount,
        orders: ordersCount,
        revenue: parseFloat(revenueRow?.revenue || 0),
      },
      recentOrders,
      lowStock,
    },
  });
});

exports.notifications = catchAsync(async (req, res) => {
  const notifications = await Notification.findAll({
    where: { user_id: req.user.id },
    order: [["created_at", "DESC"]],
    limit: 30,
  });
  const unreadCount = await Notification.count({
    where: { user_id: req.user.id, is_read: false },
  });
  res.json({ status: "success", data: { notifications, unreadCount } });
});

exports.markNotificationRead = catchAsync(async (req, res) => {
  await Notification.update(
    { is_read: true },
    { where: { id: req.params.id, user_id: req.user.id } },
  );
  res.json({ status: "success" });
});
