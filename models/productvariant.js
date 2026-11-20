'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ProductVariant extends Model {
    static associate(models) {
      ProductVariant.belongsTo(models.Product, { foreignKey: 'product_id', as: 'product' });
      ProductVariant.belongsTo(models.File, { foreignKey: 'image_file_id', as: 'imageFile' });
      ProductVariant.hasMany(models.VariantAttributeValue, { foreignKey: 'variant_id', as: 'attributeValues' });
    }
  }

  ProductVariant.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      product_id: { type: DataTypes.UUID, allowNull: false },
      sku: { type: DataTypes.STRING(100), allowNull: false, unique: true },
      price: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      compare_at_price: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      image_file_id: { type: DataTypes.UUID, allowNull: true },
      sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    { sequelize, modelName: 'ProductVariant', tableName: 'tbl_product_variants', underscored: true }
  );
  return ProductVariant;
};
