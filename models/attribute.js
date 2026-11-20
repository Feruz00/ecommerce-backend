'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Attribute extends Model {
    static associate(models) {
      Attribute.hasMany(models.AttributeOption, { foreignKey: 'attribute_id', as: 'options' });
      Attribute.hasMany(models.ProductAttributeValue, { foreignKey: 'attribute_id', as: 'productValues' });
      Attribute.hasMany(models.VariantAttributeValue, { foreignKey: 'attribute_id', as: 'variantValues' });
    }
  }

  Attribute.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      code: { type: DataTypes.STRING(80), allowNull: false, unique: true },
      type: {
        type: DataTypes.ENUM('text', 'number', 'boolean', 'select', 'color'),
        allowNull: false,
        defaultValue: 'text',
      },
      scope: {
        type: DataTypes.ENUM('product', 'variant', 'both'),
        allowNull: false,
        defaultValue: 'product',
      },
      is_filterable: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      is_required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      translations: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
      unit: { type: DataTypes.STRING(30), allowNull: true },
    },
    { sequelize, modelName: 'Attribute', tableName: 'tbl_attributes', underscored: true }
  );
  return Attribute;
};
