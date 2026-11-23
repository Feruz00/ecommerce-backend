"use strict";

const express = require("express");
const userOrderController = require("../controllers/userOrderController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.use(protect);

router.get("/", userOrderController.getMyOrders);
router.get("/:id", userOrderController.getMyOrder);

module.exports = router;
