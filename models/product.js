'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Product extends Model {
    static associate(models) {
      Product.belongsTo(models.Category, { foreignKey: 'category_id', as: 'category' });
      Product.hasMany(models.CartItem, { foreignKey: 'product_id', as: 'cartItems' });
      Product.hasMany(models.OrderItem, { foreignKey: 'product_id', as: 'orderItems' });
      Product.hasMany(models.Review, { foreignKey: 'product_id', as: 'reviews' });

      // All images for this product (tbl_files where entity_type='product')
      Product.hasMany(models.File, {
        foreignKey: 'entity_id',
        constraints: false,
        scope: { entity_type: 'product' },
        as: 'images',
      });

      // Primary image only
      Product.hasOne(models.File, {
        foreignKey: 'entity_id',
        constraints: false,
        scope: { entity_type: 'product', is_primary: true },
        as: 'primaryImage',
      });
      Product.hasMany(models.ProductAttributeValue, { foreignKey: 'product_id', as: 'attributeValues' });
      Product.hasMany(models.ProductVariant, { foreignKey: 'product_id', as: 'variants' });
    }
  }

  Product.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      sku: { type: DataTypes.STRING(100), allowNull: false, unique: true },
      slug: { type: DataTypes.STRING(200), allowNull: false, unique: true },
      price: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      compare_at_price: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      is_featured: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      category_id: { type: DataTypes.INTEGER, allowNull: false },
      translations: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
      rating_avg: {
        type: DataTypes.DECIMAL(3, 2),
        allowNull: false,
        defaultValue: 0,
      },
      rating_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      sold_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      view_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    {
      sequelize,
      modelName: 'Product',
      tableName: 'tbl_products',
      underscored: true,
    }
  );

  return Product;
};
