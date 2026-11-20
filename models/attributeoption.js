'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AttributeOption extends Model {
    static associate(models) {
      AttributeOption.belongsTo(models.Attribute, { foreignKey: 'attribute_id', as: 'attribute' });
    }
  }

  AttributeOption.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      attribute_id: { type: DataTypes.INTEGER, allowNull: false },
      value: { type: DataTypes.STRING(150), allowNull: false },
      color_hex: { type: DataTypes.STRING(20), allowNull: true },
      sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      translations: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
    },
    { sequelize, modelName: 'AttributeOption', tableName: 'tbl_attribute_options', underscored: true }
  );
  return AttributeOption;
};
