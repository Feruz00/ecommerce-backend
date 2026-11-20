'use strict';

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [files] = await queryInterface.sequelize.query(
      "SELECT id, original_name FROM tbl_files WHERE entity_type = 'category'"
    );
    const byName = Object.fromEntries(files.map((f) => [f.original_name, f.id]));

    const t = (en, tm, ru) =>
      JSON.stringify({
        en: { name: en },
        tm: { name: tm },
        ru: { name: ru },
      });

    await queryInterface.bulkInsert('tbl_categories', [
      {
        id: 1,
        slug: 'electronics',
        parent_id: null,
        image_file_id: byName['cat-electronics'] || null,
        is_active: true,
        sort_order: 1,
        translations: t('Electronics', 'Elektronika', 'Электроника'),
        created_at: now,
        updated_at: now,
      },
      {
        id: 2,
        slug: 'phones',
        parent_id: 1,
        image_file_id: null,
        is_active: true,
        sort_order: 1,
        translations: t('Phones', 'Telefonlar', 'Телефоны'),
        created_at: now,
        updated_at: now,
      },
      {
        id: 3,
        slug: 'laptops',
        parent_id: 1,
        image_file_id: null,
        is_active: true,
        sort_order: 2,
        translations: t('Laptops', 'Noutbuklar', 'Ноутбуки'),
        created_at: now,
        updated_at: now,
      },
      {
        id: 4,
        slug: 'audio',
        parent_id: 1,
        image_file_id: null,
        is_active: true,
        sort_order: 3,
        translations: t('Audio', 'Audio', 'Аудио'),
        created_at: now,
        updated_at: now,
      },
      {
        id: 5,
        slug: 'fashion',
        parent_id: null,
        image_file_id: byName['cat-fashion'] || null,
        is_active: true,
        sort_order: 2,
        translations: t('Fashion', 'Moda', 'Мода'),
        created_at: now,
        updated_at: now,
      },
      {
        id: 6,
        slug: 'men',
        parent_id: 5,
        image_file_id: null,
        is_active: true,
        sort_order: 1,
        translations: t("Men's", 'Erkek', 'Мужское'),
        created_at: now,
        updated_at: now,
      },
      {
        id: 7,
        slug: 'women',
        parent_id: 5,
        image_file_id: null,
        is_active: true,
        sort_order: 2,
        translations: t("Women's", 'Aýal', 'Женское'),
        created_at: now,
        updated_at: now,
      },
      {
        id: 8,
        slug: 'home',
        parent_id: null,
        image_file_id: byName['cat-home'] || null,
        is_active: true,
        sort_order: 3,
        translations: t('Home & Living', 'Öý we durmuş', 'Дом и быт'),
        created_at: now,
        updated_at: now,
      },
      {
        id: 9,
        slug: 'furniture',
        parent_id: 8,
        image_file_id: null,
        is_active: true,
        sort_order: 1,
        translations: t('Furniture', 'Mebel', 'Мебель'),
        created_at: now,
        updated_at: now,
      },
      {
        id: 10,
        slug: 'sports',
        parent_id: null,
        image_file_id: byName['cat-sports'] || null,
        is_active: true,
        sort_order: 4,
        translations: t('Sports', 'Sport', 'Спорт'),
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('tbl_categories', null, {});
  },
};
