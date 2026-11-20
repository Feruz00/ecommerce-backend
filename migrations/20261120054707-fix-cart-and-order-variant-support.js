"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // ============================================
    // 1. CART ITEMS
    // ============================================

    const cartTable = await queryInterface.describeTable("tbl_cart_items");

    if (!cartTable.variant_id) {
      await queryInterface.addColumn("tbl_cart_items", "variant_id", {
        type: Sequelize.UUID,
        allowNull: true,
      });
    }

    if (!cartTable.selected_attributes) {
      await queryInterface.addColumn("tbl_cart_items", "selected_attributes", {
        type: Sequelize.JSON,
        allowNull: true,
      });
    }

    // Replace the old unique index.
    const cartIndexes = await queryInterface.showIndex("tbl_cart_items");

    const oldCartIndex = cartIndexes.find(
      (index) => index.name === "uq_cart_user_product",
    );

    if (oldCartIndex) {
      await queryInterface.removeIndex(
        "tbl_cart_items",
        "uq_cart_user_product",
      );
    }

    // Refresh indexes after removing the old index.
    const updatedCartIndexes = await queryInterface.showIndex("tbl_cart_items");

    const newCartIndex = updatedCartIndexes.find(
      (index) => index.name === "uq_cart_user_product_variant",
    );

    if (!newCartIndex) {
      await queryInterface.addIndex(
        "tbl_cart_items",
        ["user_id", "product_id", "variant_id"],
        {
          name: "uq_cart_user_product_variant",
          unique: true,
        },
      );
    }

    // ============================================
    // 2. ORDER ITEMS
    // ============================================

    let orderItemTable = await queryInterface.describeTable("tbl_order_items");

    if (!orderItemTable.variant_id) {
      await queryInterface.addColumn("tbl_order_items", "variant_id", {
        type: Sequelize.UUID,
        allowNull: true,
      });
    }

    if (!orderItemTable.selected_attributes) {
      await queryInterface.addColumn("tbl_order_items", "selected_attributes", {
        type: Sequelize.JSON,
        allowNull: true,
      });
    }

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

    // ============================================
    // 3. FIX ORDER ITEM PRIMARY KEY
    // ============================================

    orderItemTable = await queryInterface.describeTable("tbl_order_items");

    // Existing database has INTEGER AUTO_INCREMENT.
    // Sequelize OrderItem model expects UUID.
    if (
      orderItemTable.id &&
      String(orderItemTable.id.type).toLowerCase().includes("int")
    ) {
      await queryInterface.changeColumn("tbl_order_items", "id", {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
      });
    }

    // ============================================
    // 4. VERIFY IMPORTANT COLUMNS
    // ============================================

    const finalCart = await queryInterface.describeTable("tbl_cart_items");

    const finalOrderItems =
      await queryInterface.describeTable("tbl_order_items");

    const requiredCartColumns = ["variant_id", "selected_attributes"];

    const requiredOrderColumns = [
      "id",
      "variant_id",
      "selected_attributes",
      "product_name",
      "product_sku",
    ];

    for (const column of requiredCartColumns) {
      if (!finalCart[column]) {
        throw new Error(`Missing tbl_cart_items.${column}`);
      }
    }

    for (const column of requiredOrderColumns) {
      if (!finalOrderItems[column]) {
        throw new Error(`Missing tbl_order_items.${column}`);
      }
    }

    console.log("Cart and order variant migration completed.");
  },

  async down() {
    throw new Error(
      "This migration is intentionally irreversible. " +
        "It changes the order item primary key to UUID and preserves existing data.",
    );
  },
};
