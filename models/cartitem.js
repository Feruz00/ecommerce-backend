"use strict";

const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class CartItem extends Model {
    static associate(models) {
      CartItem.belongsTo(models.User, {
        foreignKey: "user_id",
        as: "user",
      });

      CartItem.belongsTo(models.Product, {
        foreignKey: "product_id",
        as: "product",
      });

      if (models.ProductVariant) {
        CartItem.belongsTo(models.ProductVariant, {
          foreignKey: "variant_id",
          as: "variant",
        });
      }
    }
  }

  CartItem.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      user_id: {
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

      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        validate: {
          min: 1,
        },
      },

      selected_attributes: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "CartItem",
      tableName: "tbl_cart_items",
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ["user_id", "product_id", "variant_id"],
          name: "uq_cart_user_product_variant",
        },
      ],
    },
  );

  return CartItem;
};
