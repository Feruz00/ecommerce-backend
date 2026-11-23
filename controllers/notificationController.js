const { Op } = require("sequelize");
const { Notification } = require("../models");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

// GET /api/admin/notifications
exports.getNotifications = catchAsync(async (req, res) => {
  const userId = req.user.id;

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

  const offset = (page - 1) * limit;

  const [notifications, unreadCount, total] = await Promise.all([
    Notification.findAll({
      where: { user_id: userId },
      order: [["created_at", "DESC"]],
      limit,
      offset,
    }),

    Notification.count({
      where: {
        user_id: userId,
        is_read: false,
      },
    }),

    Notification.count({
      where: { user_id: userId },
    }),
  ]);

  res.status(200).json({
    status: "success",
    results: notifications.length,
    data: {
      notifications,
      unreadCount,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// PATCH /api/admin/notifications/:id/read
exports.markAsRead = catchAsync(async (req, res, next) => {
  const notification = await Notification.findOne({
    where: {
      id: req.params.id,
      user_id: req.user.id,
    },
  });

  if (!notification) {
    return next(new AppError("Notification not found", 404));
  }

  if (!notification.is_read) {
    notification.is_read = true;
    await notification.save();
  }

  res.status(200).json({
    status: "success",
    data: { notification },
  });
});

// PATCH /api/admin/notifications/read-all
exports.markAllAsRead = catchAsync(async (req, res) => {
  await Notification.update(
    { is_read: true },
    {
      where: {
        user_id: req.user.id,
        is_read: false,
      },
    },
  );

  res.status(200).json({
    status: "success",
    message: "All notifications marked as read",
  });
});

// DELETE /api/admin/notifications/:id
exports.deleteNotification = catchAsync(async (req, res, next) => {
  const deleted = await Notification.destroy({
    where: {
      id: req.params.id,
      user_id: req.user.id,
    },
  });

  if (!deleted) {
    return next(new AppError("Notification not found", 404));
  }

  res.status(200).json({
    status: "success",
    message: "Notification deleted",
  });
});

// DELETE /api/admin/notifications
exports.deleteAllNotifications = catchAsync(async (req, res) => {
  await Notification.destroy({
    where: {
      user_id: req.user.id,
    },
  });

  res.status(200).json({
    status: "success",
    message: "All notifications deleted",
  });
});
