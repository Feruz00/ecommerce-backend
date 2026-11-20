'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tbl_product_variants', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      product_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'tbl_products', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      sku: { type: Sequelize.STRING(100), allowNull: false },
      price: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
      compare_at_price: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
      quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      image_file_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'tbl_files', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('tbl_product_variants', ['sku'], {
      unique: true,
      name: 'uq_variants_sku',
    });
    await queryInterface.addIndex('tbl_product_variants', ['product_id'], {
      name: 'idx_variants_product',
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('tbl_product_variants');
  },
};
