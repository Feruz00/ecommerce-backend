const router = require("express").Router();

const adminController = require("../controllers/adminController");

const { protect, restrictTo } = require("../middleware/auth");

router.use(protect, restrictTo("admin", "manager"));

router.get("/dashboard", adminController.dashboard);

router.get("/notifications", adminController.notifications);
router.patch("/notifications/:id/read", adminController.markNotificationRead);

module.exports = router;
