const r = require("express").Router();
const c = require("../controllers/reportController");
const { protect, restrictTo } = require("../middleware/auth");

r.use(protect, restrictTo("admin", "manager"));

r.get("/summary", c.getSummary);
r.get("/orders", c.getOrders);
r.get("/top-products", c.getTopProducts);
r.get("/daily", c.getDaily);

// Exports
r.get("/export", c.exportOrders); // CSV
r.get("/export/excel", c.exportOrdersExcel); // Excel (.xlsx)

module.exports = r;
