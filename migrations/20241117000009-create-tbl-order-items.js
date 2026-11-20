"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("tbl_order_items", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      order_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "tbl_orders", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      product_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "tbl_products", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      variant_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      product_name: { type: Sequelize.STRING(255), allowNull: false },
      product_sku: { type: Sequelize.STRING(100), allowNull: true },
      price: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
      quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      total: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
      selected_attributes: { type: Sequelize.JSON, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex("tbl_order_items", ["order_id"], {
      name: "idx_order_items_order",
    });
    await queryInterface.addIndex("tbl_order_items", ["variant_id"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("tbl_order_items");
  },
};
