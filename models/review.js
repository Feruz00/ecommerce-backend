'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Review extends Model {
    static associate(models) {
      Review.belongsTo(models.Product, { foreignKey: 'product_id', as: 'product' });
      Review.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    }
  }

  Review.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      product_id: { type: DataTypes.UUID, allowNull: false },
      user_id: { type: DataTypes.UUID, allowNull: false },
      rating: { type: DataTypes.INTEGER, allowNull: false },
      comment: { type: DataTypes.TEXT, allowNull: true },
      is_approved: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    {
      sequelize,
      modelName: 'Review',
      tableName: 'tbl_reviews',
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ['user_id', 'product_id'],
          name: 'uq_reviews_user_product',
        },
      ],
    }
  );

  return Review;
};
