"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("tbl_users", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      first_name: { type: Sequelize.STRING(100), allowNull: false },
      last_name: { type: Sequelize.STRING(100), allowNull: false },
      username: { type: Sequelize.STRING(150), allowNull: false },
      phone: { type: Sequelize.STRING(30), allowNull: true },
      password: { type: Sequelize.STRING, allowNull: false },
      avatar_file_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "tbl_files", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      role: {
        type: Sequelize.ENUM("admin", "manager", "customer"),
        allowNull: false,
        defaultValue: "customer",
      },
      status: {
        type: Sequelize.ENUM("active", "inactive", "banned"),
        allowNull: false,
        defaultValue: "active",
      },
      preferred_lang: {
        type: Sequelize.ENUM("en", "tm", "ru"),
        allowNull: false,
        defaultValue: "en",
      },
      last_login_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex("tbl_users", ["username"], {
      unique: true,
      name: "uq_users_username",
    });
    await queryInterface.addIndex("tbl_users", ["role"], {
      name: "idx_users_role",
    });
    await queryInterface.addIndex("tbl_users", ["status"], {
      name: "idx_users_status",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("tbl_users");
  },
};
