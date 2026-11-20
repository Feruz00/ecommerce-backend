'use strict';

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const t = (en, tm, ru) =>
      JSON.stringify({
        en: { name: en },
        tm: { name: tm },
        ru: { name: ru },
      });
    const ot = (en, tm, ru) =>
      JSON.stringify({
        en: { label: en },
        tm: { label: tm },
        ru: { label: ru },
      });

    await queryInterface.bulkInsert('tbl_attributes', [
      {
        id: 1,
        code: 'brand',
        type: 'select',
        scope: 'product',
        is_filterable: true,
        is_required: false,
        sort_order: 1,
        is_active: true,
        translations: t('Brand', 'Brend', 'Бренд'),
        unit: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: 2,
        code: 'color',
        type: 'color',
        scope: 'both',
        is_filterable: true,
        is_required: false,
        sort_order: 2,
        is_active: true,
        translations: t('Color', 'Reňk', 'Цвет'),
        unit: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: 3,
        code: 'size',
        type: 'select',
        scope: 'variant',
        is_filterable: true,
        is_required: false,
        sort_order: 3,
        is_active: true,
        translations: t('Size', 'Ölçeg', 'Размер'),
        unit: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: 4,
        code: 'storage',
        type: 'select',
        scope: 'variant',
        is_filterable: true,
        is_required: false,
        sort_order: 4,
        is_active: true,
        translations: t('Storage', 'Ýat', 'Память'),
        unit: 'GB',
        created_at: now,
        updated_at: now,
      },
      {
        id: 5,
        code: 'material',
        type: 'text',
        scope: 'product',
        is_filterable: true,
        is_required: false,
        sort_order: 5,
        is_active: true,
        translations: t('Material', 'Material', 'Материал'),
        unit: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: 6,
        code: 'weight',
        type: 'number',
        scope: 'product',
        is_filterable: true,
        is_required: false,
        sort_order: 6,
        is_active: true,
        translations: t('Weight', 'Agram', 'Вес'),
        unit: 'g',
        created_at: now,
        updated_at: now,
      },
      {
        id: 7,
        code: 'warranty',
        type: 'boolean',
        scope: 'product',
        is_filterable: true,
        is_required: false,
        sort_order: 7,
        is_active: true,
        translations: t('Warranty', 'Kepillik', 'Гарантия'),
        unit: null,
        created_at: now,
        updated_at: now,
      },
    ]);

    await queryInterface.bulkInsert('tbl_attribute_options', [
      // brands
      { attribute_id: 1, value: 'apple', color_hex: null, sort_order: 1, is_active: true, translations: ot('Apple', 'Apple', 'Apple'), created_at: now, updated_at: now },
      { attribute_id: 1, value: 'samsung', color_hex: null, sort_order: 2, is_active: true, translations: ot('Samsung', 'Samsung', 'Samsung'), created_at: now, updated_at: now },
      { attribute_id: 1, value: 'sony', color_hex: null, sort_order: 3, is_active: true, translations: ot('Sony', 'Sony', 'Sony'), created_at: now, updated_at: now },
      { attribute_id: 1, value: 'xiaomi', color_hex: null, sort_order: 4, is_active: true, translations: ot('Xiaomi', 'Xiaomi', 'Xiaomi'), created_at: now, updated_at: now },
      // colors
      { attribute_id: 2, value: 'black', color_hex: '#111111', sort_order: 1, is_active: true, translations: ot('Black', 'Gara', 'Чёрный'), created_at: now, updated_at: now },
      { attribute_id: 2, value: 'white', color_hex: '#ffffff', sort_order: 2, is_active: true, translations: ot('White', 'Ak', 'Белый'), created_at: now, updated_at: now },
      { attribute_id: 2, value: 'blue', color_hex: '#2563eb', sort_order: 3, is_active: true, translations: ot('Blue', 'Gök', 'Синий'), created_at: now, updated_at: now },
      { attribute_id: 2, value: 'red', color_hex: '#ef4444', sort_order: 4, is_active: true, translations: ot('Red', 'Gyzyl', 'Красный'), created_at: now, updated_at: now },
      // sizes
      { attribute_id: 3, value: 's', color_hex: null, sort_order: 1, is_active: true, translations: ot('S', 'S', 'S'), created_at: now, updated_at: now },
      { attribute_id: 3, value: 'm', color_hex: null, sort_order: 2, is_active: true, translations: ot('M', 'M', 'M'), created_at: now, updated_at: now },
      { attribute_id: 3, value: 'l', color_hex: null, sort_order: 3, is_active: true, translations: ot('L', 'L', 'L'), created_at: now, updated_at: now },
      { attribute_id: 3, value: 'xl', color_hex: null, sort_order: 4, is_active: true, translations: ot('XL', 'XL', 'XL'), created_at: now, updated_at: now },
      // storage
      { attribute_id: 4, value: '128', color_hex: null, sort_order: 1, is_active: true, translations: ot('128 GB', '128 GB', '128 ГБ'), created_at: now, updated_at: now },
      { attribute_id: 4, value: '256', color_hex: null, sort_order: 2, is_active: true, translations: ot('256 GB', '256 GB', '256 ГБ'), created_at: now, updated_at: now },
      { attribute_id: 4, value: '512', color_hex: null, sort_order: 3, is_active: true, translations: ot('512 GB', '512 GB', '512 ГБ'), created_at: now, updated_at: now },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('tbl_attribute_options', null, {});
    await queryInterface.bulkDelete('tbl_attributes', null, {});
  },
};
