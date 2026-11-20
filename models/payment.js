'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Payment extends Model {
    static associate(models) {
      Payment.belongsTo(models.Order, { foreignKey: 'order_id', as: 'order' });
    }
  }

  Payment.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      order_id: { type: DataTypes.UUID, allowNull: false },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      method: { type: DataTypes.STRING(50), allowNull: false },
      status: {
        type: DataTypes.ENUM('pending', 'completed', 'failed', 'refunded'),
        allowNull: false,
        defaultValue: 'pending',
      },
      transaction_id: { type: DataTypes.STRING(150), allowNull: true },
      meta: { type: DataTypes.JSON, allowNull: true },
      paid_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName: 'Payment',
      tableName: 'tbl_payments',
      underscored: true,
    }
  );

  return Payment;
};
