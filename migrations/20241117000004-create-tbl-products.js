"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("tbl_products", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      sku: { type: Sequelize.STRING(100), allowNull: false },
      // slug: { type: Sequelize.STRING(200), allowNull: false },
      price: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      compare_at_price: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
      quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      is_featured: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      category_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "tbl_categories", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      translations: { type: Sequelize.JSON, allowNull: false },
      rating_avg: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: false,
        defaultValue: 0,
      },
      rating_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      sold_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      view_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex("tbl_products", ["sku"], {
      unique: true,
      name: "uq_products_sku",
    });

    await queryInterface.addIndex("tbl_products", ["category_id"], {
      name: "idx_products_category",
    });
    await queryInterface.addIndex(
      "tbl_products",
      ["is_active", "is_featured"],
      {
        name: "idx_products_active_featured",
      },
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("tbl_products");
  },
};
