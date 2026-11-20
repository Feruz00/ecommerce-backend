'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tbl_categories', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      slug: { type: Sequelize.STRING(150), allowNull: false },
      parent_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'tbl_categories', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      image_file_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'tbl_files', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      translations: { type: Sequelize.JSON, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('tbl_categories', ['slug'], {
      unique: true,
      name: 'uq_categories_slug',
    });
    await queryInterface.addIndex('tbl_categories', ['parent_id'], {
      name: 'idx_categories_parent',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tbl_categories');
  },
};
