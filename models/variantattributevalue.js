'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class VariantAttributeValue extends Model {
    static associate(models) {
      VariantAttributeValue.belongsTo(models.ProductVariant, { foreignKey: 'variant_id', as: 'variant' });
      VariantAttributeValue.belongsTo(models.Attribute, { foreignKey: 'attribute_id', as: 'attribute' });
      VariantAttributeValue.belongsTo(models.AttributeOption, { foreignKey: 'option_id', as: 'option' });
    }
  }

  VariantAttributeValue.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      variant_id: { type: DataTypes.UUID, allowNull: false },
      attribute_id: { type: DataTypes.INTEGER, allowNull: false },
      option_id: { type: DataTypes.INTEGER, allowNull: true },
      value_text: { type: DataTypes.STRING(500), allowNull: true },
    },
    { sequelize, modelName: 'VariantAttributeValue', tableName: 'tbl_variant_attribute_values', underscored: true }
  );
  return VariantAttributeValue;
};
