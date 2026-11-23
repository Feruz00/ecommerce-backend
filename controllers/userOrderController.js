"use strict";

const { Order, OrderItem, Payment } = require("../models");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

// GET /api/my-orders
exports.getMyOrders = catchAsync(async (req, res) => {
  const userId = req.user.id;

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));

  const where = { user_id: userId };

  if (req.query.status) {
    if (!ORDER_STATUSES.includes(req.query.status)) {
      throw new AppError("Invalid order status", 400);
    }

    where.status = req.query.status;
  }

  const { count, rows } = await Order.findAndCountAll({
    where,
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
    distinct: true,
    order: [["created_at", "DESC"]],
    limit,
    offset: (page - 1) * limit,
  });

  res.status(200).json({
    status: "success",
    results: rows.length,
    pagination: {
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    },
    data: {
      orders: rows,
    },
  });
});

// GET /api/my-orders/:id
exports.getMyOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findOne({
    where: {
      id: req.params.id,
      user_id: req.user.id,
    },
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

  if (!order) {
    return next(new AppError("Order not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      order,
    },
  });
});
