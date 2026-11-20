"use strict";
const { Model } = require("sequelize");
const bcrypt = require("bcryptjs");

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.belongsTo(models.File, {
        foreignKey: "avatar_file_id",
        as: "avatar",
      });
      User.hasMany(models.CartItem, { foreignKey: "user_id", as: "cartItems" });
      User.hasMany(models.Order, { foreignKey: "user_id", as: "orders" });
      User.hasMany(models.Address, { foreignKey: "user_id", as: "addresses" });
      User.hasMany(models.Review, { foreignKey: "user_id", as: "reviews" });
      User.hasMany(models.Notification, {
        foreignKey: "user_id",
        as: "notifications",
      });
    }

    async comparePassword(candidate) {
      return bcrypt.compare(candidate, this.password);
    }

    toJSON() {
      const values = { ...this.get() };
      delete values.password;
      return values;
    }
  }

  User.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      first_name: { type: DataTypes.STRING(100), allowNull: false },
      last_name: { type: DataTypes.STRING(100), allowNull: false },
      username: { type: DataTypes.STRING(150), allowNull: false, unique: true },
      phone: { type: DataTypes.STRING(30), allowNull: true },
      password: { type: DataTypes.STRING, allowNull: false },
      avatar_file_id: { type: DataTypes.UUID, allowNull: true },
      role: {
        type: DataTypes.ENUM("admin", "manager", "customer"),
        allowNull: false,
        defaultValue: "customer",
      },
      status: {
        type: DataTypes.ENUM("active", "inactive", "banned"),
        allowNull: false,
        defaultValue: "active",
      },
      preferred_lang: {
        type: DataTypes.ENUM("en", "tm", "ru"),
        allowNull: false,
        defaultValue: "en",
      },
      last_login_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName: "User",
      tableName: "tbl_users",
      underscored: true,
      hooks: {
        beforeCreate: async (user) => {
          if (user.password)
            user.password = await bcrypt.hash(user.password, 12);
        },
        beforeUpdate: async (user) => {
          if (user.changed("password")) {
            user.password = await bcrypt.hash(user.password, 12);
          }
        },
      },
    },
  );

  return User;
};
