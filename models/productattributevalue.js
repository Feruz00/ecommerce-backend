'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ProductAttributeValue extends Model {
    static associate(models) {
      ProductAttributeValue.belongsTo(models.Product, { foreignKey: 'product_id', as: 'product' });
      ProductAttributeValue.belongsTo(models.Attribute, { foreignKey: 'attribute_id', as: 'attribute' });
      ProductAttributeValue.belongsTo(models.AttributeOption, { foreignKey: 'option_id', as: 'option' });
    }
  }

  ProductAttributeValue.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      product_id: { type: DataTypes.UUID, allowNull: false },
      attribute_id: { type: DataTypes.INTEGER, allowNull: false },
      option_id: { type: DataTypes.INTEGER, allowNull: true },
      value_text: { type: DataTypes.STRING(500), allowNull: true },
      value_number: { type: DataTypes.DECIMAL(16, 4), allowNull: true },
      value_boolean: { type: DataTypes.BOOLEAN, allowNull: true },
    },
    { sequelize, modelName: 'ProductAttributeValue', tableName: 'tbl_product_attribute_values', underscored: true }
  );
  return ProductAttributeValue;
};
