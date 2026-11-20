"use strict";

const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class OrderItem extends Model {
    static associate(models) {
      OrderItem.belongsTo(models.Order, {
        foreignKey: "order_id",
        as: "order",
      });

      OrderItem.belongsTo(models.Product, {
        foreignKey: "product_id",
        as: "product",
      });

      // Add this association if your model is named ProductVariant.
      if (models.ProductVariant) {
        OrderItem.belongsTo(models.ProductVariant, {
          foreignKey: "variant_id",
          as: "variant",
        });
      }
    }
  }

  OrderItem.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      order_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      product_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      variant_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      product_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },

      product_sku: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      price: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },

      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },

      total: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },

      selected_attributes: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "OrderItem",
      tableName: "tbl_order_items",
      underscored: true,
    },
  );

  return OrderItem;
};
