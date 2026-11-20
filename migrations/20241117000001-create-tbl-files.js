'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tbl_files', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      original_name: { type: Sequelize.STRING(255), allowNull: false },
      filename: { type: Sequelize.STRING(255), allowNull: false },
      path: { type: Sequelize.STRING(500), allowNull: false },
      url: { type: Sequelize.STRING(500), allowNull: false },
      mime_type: { type: Sequelize.STRING(100), allowNull: true },
      size: { type: Sequelize.INTEGER, allowNull: true },
      disk: { type: Sequelize.STRING(50), allowNull: false, defaultValue: 'local' },
      alt: { type: Sequelize.STRING(255), allowNull: true },
      entity_type: { type: Sequelize.STRING(50), allowNull: true },
      entity_id: { type: Sequelize.STRING(50), allowNull: true },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      is_primary: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('tbl_files', ['entity_type', 'entity_id'], {
      name: 'idx_files_entity',
    });
    await queryInterface.addIndex('tbl_files', ['entity_type', 'entity_id', 'is_primary'], {
      name: 'idx_files_entity_primary',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tbl_files');
  },
};
