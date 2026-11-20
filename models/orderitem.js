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
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
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

      // Snapshot fields – never change after order is placed
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
        defaultValue: 0,
      },

      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        validate: { min: 1 },
      },

      total: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },

      /**
       * Human-readable attribute snapshot, e.g.
       * { color: "Black", size: "XL", variant_id: "uuid-..." }
       * Stored so admin / order history stays correct even if catalog changes.
       */
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
