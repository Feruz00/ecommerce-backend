const express = require("express");

const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
} = require("../controllers/notificationController");

const { protect, restrictTo } = require("../middleware/auth");

const router = express.Router();

router.use(protect);
router.use(restrictTo("admin", "manager"));

router.get("/", getNotifications);

router.patch("/read-all", markAllAsRead);
router.delete("/", deleteAllNotifications);

router.patch("/:id/read", markAsRead);
router.delete("/:id", deleteNotification);

module.exports = router;
