"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("tbl_banners", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      image_file_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "tbl_files", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      link: { type: Sequelize.STRING(500), allowNull: true },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      sort_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("tbl_banners");
  },
};
