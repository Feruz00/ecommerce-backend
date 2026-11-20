"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("tbl_cart_items", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "tbl_users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      product_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "tbl_products", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      variant_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      selected_attributes: { type: Sequelize.JSON, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex("tbl_cart_items", ["user_id", "product_id"], {
      unique: true,
      name: "uq_cart_user_product",
    });
    await queryInterface.addIndex("tbl_cart_items", ["variant_id"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("tbl_cart_items");
  },
};
