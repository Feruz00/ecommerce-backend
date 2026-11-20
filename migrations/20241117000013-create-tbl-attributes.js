'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tbl_attributes', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      code: { type: Sequelize.STRING(80), allowNull: false },
      type: {
        type: Sequelize.ENUM('text', 'number', 'boolean', 'select', 'color'),
        allowNull: false,
        defaultValue: 'text',
      },
      // product = product-level spec; variant = used for variants (size/color)
      scope: {
        type: Sequelize.ENUM('product', 'variant', 'both'),
        allowNull: false,
        defaultValue: 'product',
      },
      is_filterable: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      is_required: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      translations: { type: Sequelize.JSON, allowNull: false },
      unit: { type: Sequelize.STRING(30), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('tbl_attributes', ['code'], {
      unique: true,
      name: 'uq_attributes_code',
    });
    await queryInterface.addIndex('tbl_attributes', ['is_filterable', 'is_active'], {
      name: 'idx_attributes_filterable',
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('tbl_attributes');
  },
};
