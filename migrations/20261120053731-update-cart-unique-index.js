"use strict";

module.exports = {
  async up(queryInterface) {
    const table = "tbl_cart_items";

    let indexes = await queryInterface.showIndex(table);

    const oldIndex = indexes.find(
      (index) => index.name === "uq_cart_user_product",
    );

    const newIndex = indexes.find(
      (index) => index.name === "uq_cart_user_product_variant",
    );

    // Remove the old unique index if it exists.
    if (oldIndex) {
      await queryInterface.removeIndex(table, "uq_cart_user_product");
    }

    // Create the new unique index only if it does not exist.
    if (!newIndex) {
      await queryInterface.addIndex(
        table,
        ["user_id", "product_id", "variant_id"],
        {
          name: "uq_cart_user_product_variant",
          unique: true,
        },
      );
    }
  },

  async down(queryInterface) {
    const table = "tbl_cart_items";

    const indexes = await queryInterface.showIndex(table);

    const newIndex = indexes.find(
      (index) => index.name === "uq_cart_user_product_variant",
    );

    if (newIndex) {
      await queryInterface.removeIndex(table, "uq_cart_user_product_variant");
    }

    const remainingIndexes = await queryInterface.showIndex(table);

    const oldIndex = remainingIndexes.find(
      (index) => index.name === "uq_cart_user_product",
    );

    if (!oldIndex) {
      await queryInterface.addIndex(table, ["user_id", "product_id"], {
        name: "uq_cart_user_product",
        unique: true,
      });
    }
  },
};
