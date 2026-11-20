const r = require("express").Router();
const c = require("../controllers/orderController");
const { protect, restrictTo } = require("../middleware/auth");

r.use(protect);

r.post("/checkout", c.checkout);
r.get("/my", c.myOrders);
r.get("/:id", c.getOne);

r.get("/", restrictTo("admin", "manager"), c.getAll);
r.patch("/:id/status", restrictTo("admin", "manager"), c.updateStatus);
r.patch("/:id", restrictTo("admin", "manager"), c.updateStatus);

module.exports = r;
