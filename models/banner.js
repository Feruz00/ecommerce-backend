"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Banner extends Model {
    static associate(models) {
      Banner.belongsTo(models.File, {
        foreignKey: "image_file_id",
        as: "imageFile",
      });
    }
  }

  Banner.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      image_file_id: { type: DataTypes.UUID, allowNull: true },
      link: { type: DataTypes.STRING(500), allowNull: true },
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
    },
    {
      sequelize,
      modelName: "Banner",
      tableName: "tbl_banners",
      underscored: true,
    },
  );

  return Banner;
};
