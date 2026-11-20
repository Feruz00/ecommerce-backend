"use strict";

/**
 * Migration: ensure cart_items and order_items have variant support
 * and selected_attributes JSON column.
 *
 * Safe to run multiple times (uses IF NOT EXISTS style checks via describe).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // ---------- tbl_cart_items ----------
    const cartTable = await queryInterface.describeTable("tbl_cart_items");

    if (!cartTable.variant_id) {
      await queryInterface.addColumn("tbl_cart_items", "variant_id", {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "tbl_product_variants", // adjust if your table name differs
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
    }

    if (!cartTable.selected_attributes) {
      await queryInterface.addColumn("tbl_cart_items", "selected_attributes", {
        type: Sequelize.JSON,
        allowNull: true,
      });
    }

    // Unique index: one row per user+product+variant combination
    // Drop old unique index on (user_id, product_id) if it exists, then create the new one.
    try {
      await queryInterface.removeIndex(
        "tbl_cart_items",
        "uq_cart_user_product",
      );
    } catch (_) {
      /* index may not exist */
    }

    try {
      await queryInterface.addIndex("tbl_cart_items", {
        fields: ["user_id", "product_id", "variant_id"],
        unique: true,
        name: "uq_cart_user_product_variant",
      });
    } catch (_) {
      /* already exists */
    }

    // ---------- tbl_order_items ----------
    const orderItemTable = await queryInterface.describeTable(
      "tbl_order_items",
    );

    if (!orderItemTable.variant_id) {
      await queryInterface.addColumn("tbl_order_items", "variant_id", {
        type: Sequelize.UUID,
        allowNull: true,
      });
    }

    if (!orderItemTable.selected_attributes) {
      await queryInterface.addColumn(
        "tbl_order_items",
        "selected_attributes",
        {
          type: Sequelize.JSON,
          allowNull: true,
        },
      );
    }

    // Snapshot columns that should already exist, but ensure them
    if (!orderItemTable.product_name) {
      await queryInterface.addColumn("tbl_order_items", "product_name", {
        type: Sequelize.STRING(255),
        allowNull: false,
        defaultValue: "Product",
      });
    }

    if (!orderItemTable.product_sku) {
      await queryInterface.addColumn("tbl_order_items", "product_sku", {
        type: Sequelize.STRING(100),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    // Best-effort rollback
    try {
      await queryInterface.removeIndex(
        "tbl_cart_items",
        "uq_cart_user_product_variant",
      );
    } catch (_) {}

    try {
      await queryInterface.removeColumn("tbl_cart_items", "selected_attributes");
    } catch (_) {}
    try {
      await queryInterface.removeColumn("tbl_cart_items", "variant_id");
    } catch (_) {}

    try {
      await queryInterface.removeColumn(
        "tbl_order_items",
        "selected_attributes",
      );
    } catch (_) {}
    try {
      await queryInterface.removeColumn("tbl_order_items", "variant_id");
    } catch (_) {}
  },
};
