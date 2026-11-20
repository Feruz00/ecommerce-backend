'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const mk = (key, url, entity_type = null) => ({
      id: uuidv4(),
      original_name: key,
      filename: key,
      path: url,
      url,
      mime_type: 'image/jpeg',
      size: 0,
      disk: 'url',
      alt: key,
      entity_type,
      entity_id: null,
      sort_order: 0,
      is_primary: true,
      created_at: now,
      updated_at: now,
      _key: key,
    });

    const rows = [
      mk('banner1', 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1600&q=80', 'banner'),
      mk('banner2', 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=1600&q=80', 'banner'),
      mk('banner3', 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1600&q=80', 'banner'),
      mk('cat-electronics', 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=600&q=80', 'category'),
      mk('cat-fashion', 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=600&q=80', 'category'),
      mk('cat-home', 'https://images.unsplash.com/photo-1484101403633-562f891dc89a?w=600&q=80', 'category'),
      mk('cat-sports', 'https://images.unsplash.com/photo-1461896836934-ffe607ba6851?w=600&q=80', 'category'),
      mk('p1', 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&q=80', 'product'),
      mk('p2', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80', 'product'),
      mk('p3', 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80', 'product'),
      mk('p4', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80', 'product'),
      mk('p5', 'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=800&q=80', 'product'),
      mk('p6', 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800&q=80', 'product'),
      mk('p7', 'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=800&q=80', 'product'),
      mk('p8', 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800&q=80', 'product'),
      mk('p9', 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80', 'product'),
      mk('p10', 'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=800&q=80', 'product'),
      mk('p11', 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800&q=80', 'product'),
      mk('p12', 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=800&q=80', 'product'),
    ];

    // stash ids for later seeders via SequelizeMeta-less approach: insert and return map in env is not possible
    // We'll re-query by original_name in next seeders
    const insertRows = rows.map(({ _key, ...r }) => r);
    await queryInterface.bulkInsert('tbl_files', insertRows);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('tbl_files', null, {});
  },
};
