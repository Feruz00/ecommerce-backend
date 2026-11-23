"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Order extends Model {
    static associate(models) {
      Order.belongsTo(models.User, { foreignKey: "user_id", as: "user" });
      Order.hasMany(models.OrderItem, { foreignKey: "order_id", as: "items" });
      Order.hasMany(models.Payment, { foreignKey: "order_id", as: "payments" });
    }
  }

  Order.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      order_number: {
        type: DataTypes.STRING(30),
        allowNull: false,
        unique: true,
      },
      user_id: { type: DataTypes.UUID, allowNull: false },
      status: {
        type: DataTypes.ENUM(
          "pending",
          "confirmed",
          "processing",
          "shipped",
          "delivered",
          "cancelled",
        ),
        allowNull: false,
        defaultValue: "pending",
      },
      // payment_status: {
      //   type: DataTypes.ENUM('pending', 'paid', 'failed', 'refunded'),
      //   allowNull: false,
      //   defaultValue: 'pending',
      // },
      payment_method: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "cash",
      },
      subtotal: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      shipping_cost: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      delivery_method: {
        type: DataTypes.ENUM("delivery", "pickup"),
        allowNull: false,
        defaultValue: "delivery",
      },
      discount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      total: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      shipping_address: { type: DataTypes.JSON, allowNull: true },
      note: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      sequelize,
      modelName: "Order",
      tableName: "tbl_orders",
      underscored: true,
    },
  );

  return Order;
};
