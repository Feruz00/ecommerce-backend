'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [files] = await queryInterface.sequelize.query(
      "SELECT id, original_name FROM tbl_files WHERE entity_type = 'product'"
    );
    const byName = Object.fromEntries(files.map((f) => [f.original_name, f.id]));

    const tr = (en, tm, ru, short = '') =>
      JSON.stringify({
        en: {
          name: en,
          shortDescription: short || en,
          description: `${en}. High quality product available in our marketplace.`,
        },
        tm: {
          name: tm,
          shortDescription: short || tm,
          description: `${tm}. Ýokary hilli önüm.`,
        },
        ru: {
          name: ru,
          shortDescription: short || ru,
          description: `${ru}. Качественный товар в нашем магазине.`,
        },
      });

    const products = [
      {
        key: 'p1',
        sku: 'PHN-001',
        slug: 'smartphone-x1',
        price: 4500,
        compare_at_price: 5200,
        quantity: 40,
        is_featured: true,
        category_id: 2,
        translations: tr('Smartphone X1', 'Smartfon X1', 'Смартфон X1', 'Flagship phone'),
      },
      {
        key: 'p2',
        sku: 'AUD-001',
        slug: 'wireless-headphones',
        price: 890,
        compare_at_price: 1100,
        quantity: 80,
        is_featured: true,
        category_id: 4,
        translations: tr('Wireless Headphones', 'Simsiz naushnik', 'Беспроводные наушники'),
      },
      {
        key: 'p3',
        sku: 'WCH-001',
        slug: 'smart-watch-pro',
        price: 1200,
        compare_at_price: 1500,
        quantity: 55,
        is_featured: true,
        category_id: 2,
        translations: tr('Smart Watch Pro', 'Akylly sagat Pro', 'Умные часы Pro'),
      },
      {
        key: 'p4',
        sku: 'SHOE-001',
        slug: 'running-shoes',
        price: 650,
        compare_at_price: 800,
        quantity: 100,
        is_featured: false,
        category_id: 10,
        translations: tr('Running Shoes', 'Ylgaw köwüş', 'Беговые кроссовки'),
      },
      {
        key: 'p5',
        sku: 'BAG-001',
        slug: 'leather-backpack',
        price: 420,
        compare_at_price: null,
        quantity: 60,
        is_featured: false,
        category_id: 6,
        translations: tr('Leather Backpack', 'Deri ryukzak', 'Кожаный рюкзак'),
      },
      {
        key: 'p6',
        sku: 'SUN-001',
        slug: 'classic-sunglasses',
        price: 280,
        compare_at_price: 350,
        quantity: 120,
        is_featured: true,
        category_id: 7,
        translations: tr('Classic Sunglasses', 'Klassiki äýnek', 'Классические очки'),
      },
      {
        key: 'p7',
        sku: 'PERF-001',
        slug: 'eau-de-parfum',
        price: 550,
        compare_at_price: null,
        quantity: 45,
        is_featured: false,
        category_id: 7,
        translations: tr('Eau de Parfum', 'Atir', 'Парфюм'),
      },
      {
        key: 'p8',
        sku: 'CAM-001',
        slug: 'instant-camera',
        price: 980,
        compare_at_price: 1200,
        quantity: 30,
        is_featured: true,
        category_id: 1,
        translations: tr('Instant Camera', 'Instant kamera', 'Моментальная камера'),
      },
      {
        key: 'p9',
        sku: 'BAG-002',
        slug: 'travel-duffel',
        price: 380,
        compare_at_price: 450,
        quantity: 70,
        is_featured: false,
        category_id: 6,
        translations: tr('Travel Duffel', 'Syýahat sumkasy', 'Дорожная сумка'),
      },
      {
        key: 'p10',
        sku: 'AUD-002',
        slug: 'studio-headphones',
        price: 1100,
        compare_at_price: 1400,
        quantity: 35,
        is_featured: false,
        category_id: 4,
        translations: tr('Studio Headphones', 'Studiýa naushnikleri', 'Студийные наушники'),
      },
      {
        key: 'p11',
        sku: 'AUD-003',
        slug: 'noise-cancelling-buds',
        price: 720,
        compare_at_price: 900,
        quantity: 90,
        is_featured: true,
        category_id: 4,
        translations: tr('Noise Cancelling Buds', 'Ses basýan gulaklyklar', 'Наушники с шумоподавлением'),
      },
      {
        key: 'p12',
        sku: 'SPK-001',
        slug: 'portable-speaker',
        price: 490,
        compare_at_price: 600,
        quantity: 85,
        is_featured: false,
        category_id: 4,
        translations: tr('Portable Speaker', 'Göçme kolonka', 'Портативная колонка'),
      },
    ];

    const productRows = [];
    const fileUpdates = [];

    for (const p of products) {
      const id = uuidv4();
      productRows.push({
        id,
        sku: p.sku,
        slug: p.slug,
        price: p.price,
        compare_at_price: p.compare_at_price,
        quantity: p.quantity,
        is_active: true,
        is_featured: p.is_featured,
        category_id: p.category_id,
        translations: p.translations,
        rating_avg: (Math.random() * 1.5 + 3.5).toFixed(2),
        rating_count: Math.floor(Math.random() * 80) + 5,
        sold_count: Math.floor(Math.random() * 200),
        view_count: Math.floor(Math.random() * 1000),
        created_at: now,
        updated_at: now,
      });

      if (byName[p.key]) {
        fileUpdates.push({ fileId: byName[p.key], productId: id });
      }
    }

    await queryInterface.bulkInsert('tbl_products', productRows);

    // Link tbl_files → products
    for (const u of fileUpdates) {
      await queryInterface.sequelize.query(
        `UPDATE tbl_files
         SET entity_type = 'product', entity_id = :pid, is_primary = 1, updated_at = :now
         WHERE id = :fid`,
        {
          replacements: { pid: String(u.productId), fid: u.fileId, now },
        }
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('tbl_products', null, {});
  },
};
