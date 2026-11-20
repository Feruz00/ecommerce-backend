'use strict';

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [files] = await queryInterface.sequelize.query(
      "SELECT id, original_name FROM tbl_files WHERE entity_type = 'banner'"
    );
    const byName = Object.fromEntries(files.map((f) => [f.original_name, f.id]));

    const t = (en, tm, ru) =>
      JSON.stringify({
        en: { title: en },
        tm: { title: tm },
        ru: { title: ru },
      });

    await queryInterface.bulkInsert('tbl_banners', [
      {
        image_file_id: byName.banner1 || null,
        link: '/products',
        is_active: true,
        sort_order: 1,
        translations: t(
          'Summer Sale up to 50%',
          'Tomus satuw 50% çenli',
          'Летняя распродажа до 50%'
        ),
        created_at: now,
        updated_at: now,
      },
      {
        image_file_id: byName.banner2 || null,
        link: '/products?category=1',
        is_active: true,
        sort_order: 2,
        translations: t(
          'New Electronics Arrivals',
          'Täze elektronika',
          'Новая электроника'
        ),
        created_at: now,
        updated_at: now,
      },
      {
        image_file_id: byName.banner3 || null,
        link: '/products?category=5',
        is_active: true,
        sort_order: 3,
        translations: t(
          'Fashion Collection 2026',
          'Moda kolleksiýasy 2026',
          'Модная коллекция 2026'
        ),
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('tbl_banners', null, {});
  },
};
