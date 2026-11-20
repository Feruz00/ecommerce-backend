'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Address extends Model {
    static associate(models) {
      Address.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    }
  }

  Address.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      user_id: { type: DataTypes.UUID, allowNull: false },
      full_name: { type: DataTypes.STRING(150), allowNull: false },
      phone: { type: DataTypes.STRING(30), allowNull: false },
      city: { type: DataTypes.STRING(100), allowNull: false },
      district: { type: DataTypes.STRING(100), allowNull: true },
      street: { type: DataTypes.STRING(255), allowNull: false },
      is_default: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    {
      sequelize,
      modelName: 'Address',
      tableName: 'tbl_addresses',
      underscored: true,
    }
  );

  return Address;
};
