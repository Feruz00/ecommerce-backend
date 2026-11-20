'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tbl_variant_attribute_values', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      variant_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'tbl_product_variants', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      attribute_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'tbl_attributes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      option_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'tbl_attribute_options', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      value_text: { type: Sequelize.STRING(500), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('tbl_variant_attribute_values', ['variant_id', 'attribute_id'], {
      unique: true,
      name: 'uq_vav_variant_attr',
    });
    await queryInterface.addIndex('tbl_variant_attribute_values', ['attribute_id', 'option_id'], {
      name: 'idx_vav_attr_option',
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('tbl_variant_attribute_values');
  },
};
