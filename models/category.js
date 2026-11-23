"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Category extends Model {
    static associate(models) {
      Category.belongsTo(models.Category, {
        foreignKey: "parent_id",
        as: "parent",
      });
      Category.hasMany(models.Category, {
        foreignKey: "parent_id",
        as: "children",
      });
      Category.hasMany(models.Product, {
        foreignKey: "category_id",
        as: "products",
      });
      Category.belongsTo(models.File, {
        foreignKey: "image_file_id",
        as: "imageFile",
      });
    }
  }

  Category.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      // slug: { type: DataTypes.STRING(150), allowNull: false, unique: true },
      parent_id: { type: DataTypes.INTEGER, allowNull: true },
      image_file_id: { type: DataTypes.UUID, allowNull: true },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      sort_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      translations: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
      },
    },
    {
      sequelize,
      modelName: "Category",
      tableName: "tbl_categories",
      underscored: true,
    },
  );

  return Category;
};
