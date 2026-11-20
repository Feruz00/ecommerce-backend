'use strict';

/** Attach sample EAV values + variants to seeded products */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [products] = await queryInterface.sequelize.query(
      "SELECT id, sku FROM tbl_products ORDER BY sku ASC"
    );
    if (!products.length) return;

    const [options] = await queryInterface.sequelize.query(
      'SELECT id, attribute_id, value FROM tbl_attribute_options'
    );
    const opt = (attrId, value) =>
      options.find((o) => o.attribute_id === attrId && o.value === value);

    const pav = [];
    const bySku = Object.fromEntries(products.map((p) => [p.sku, p.id]));

    // Smartphone X1 — brand Apple, warranty, weight
    if (bySku['PHN-001']) {
      const pid = bySku['PHN-001'];
      pav.push(
        { product_id: pid, attribute_id: 1, option_id: opt(1, 'apple')?.id, value_text: null, value_number: null, value_boolean: null, created_at: now, updated_at: now },
        { product_id: pid, attribute_id: 6, option_id: null, value_text: null, value_number: 189, value_boolean: null, created_at: now, updated_at: now },
        { product_id: pid, attribute_id: 7, option_id: null, value_text: null, value_number: null, value_boolean: true, created_at: now, updated_at: now }
      );
    }
    // Headphones Sony
    if (bySku['AUD-001']) {
      const pid = bySku['AUD-001'];
      pav.push(
        { product_id: pid, attribute_id: 1, option_id: opt(1, 'sony')?.id, value_text: null, value_number: null, value_boolean: null, created_at: now, updated_at: now },
        { product_id: pid, attribute_id: 5, option_id: null, value_text: 'Plastic / Metal', value_number: null, value_boolean: null, created_at: now, updated_at: now }
      );
    }
    // Watch
    if (bySku['WCH-001']) {
      const pid = bySku['WCH-001'];
      pav.push(
        { product_id: pid, attribute_id: 1, option_id: opt(1, 'samsung')?.id, value_text: null, value_number: null, value_boolean: null, created_at: now, updated_at: now },
        { product_id: pid, attribute_id: 7, option_id: null, value_text: null, value_number: null, value_boolean: true, created_at: now, updated_at: now }
      );
    }

    const clean = pav.filter((r) => r.product_id);
    if (clean.length) await queryInterface.bulkInsert('tbl_product_attribute_values', clean);

    // Variants for PHN-001: color + storage
    if (bySku['PHN-001']) {
      const pid = bySku['PHN-001'];
      const { v4: uuidv4 } = require('uuid');
      const v1 = uuidv4();
      const v2 = uuidv4();
      const v3 = uuidv4();
      await queryInterface.bulkInsert('tbl_product_variants', [
        { id: v1, product_id: pid, sku: 'PHN-001-BLK-256', price: 4500, compare_at_price: 5200, quantity: 15, is_active: true, image_file_id: null, sort_order: 0, created_at: now, updated_at: now },
        { id: v2, product_id: pid, sku: 'PHN-001-WHT-256', price: 4500, compare_at_price: 5200, quantity: 10, is_active: true, image_file_id: null, sort_order: 1, created_at: now, updated_at: now },
        { id: v3, product_id: pid, sku: 'PHN-001-BLK-512', price: 5200, compare_at_price: 5900, quantity: 8, is_active: true, image_file_id: null, sort_order: 2, created_at: now, updated_at: now },
      ]);
      await queryInterface.bulkInsert('tbl_variant_attribute_values', [
        { variant_id: v1, attribute_id: 2, option_id: opt(2, 'black')?.id, value_text: null, created_at: now, updated_at: now },
        { variant_id: v1, attribute_id: 4, option_id: opt(4, '256')?.id, value_text: null, created_at: now, updated_at: now },
        { variant_id: v2, attribute_id: 2, option_id: opt(2, 'white')?.id, value_text: null, created_at: now, updated_at: now },
        { variant_id: v2, attribute_id: 4, option_id: opt(4, '256')?.id, value_text: null, created_at: now, updated_at: now },
        { variant_id: v3, attribute_id: 2, option_id: opt(2, 'black')?.id, value_text: null, created_at: now, updated_at: now },
        { variant_id: v3, attribute_id: 4, option_id: opt(4, '512')?.id, value_text: null, created_at: now, updated_at: now },
      ]);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('tbl_variant_attribute_values', null, {});
    await queryInterface.bulkDelete('tbl_product_variants', null, {});
    await queryInterface.bulkDelete('tbl_product_attribute_values', null, {});
  },
};
