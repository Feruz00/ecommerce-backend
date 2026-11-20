'use strict';

/** EAV: product-level attribute values */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tbl_product_attribute_values', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      product_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'tbl_products', key: 'id' },
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
      value_number: { type: Sequelize.DECIMAL(16, 4), allowNull: true },
      value_boolean: { type: Sequelize.BOOLEAN, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('tbl_product_attribute_values', ['product_id', 'attribute_id'], {
      unique: true,
      name: 'uq_pav_product_attr',
    });
    await queryInterface.addIndex('tbl_product_attribute_values', ['attribute_id', 'option_id'], {
      name: 'idx_pav_attr_option',
    });
    await queryInterface.addIndex('tbl_product_attribute_values', ['attribute_id', 'value_text'], {
      name: 'idx_pav_attr_text',
    });
    await queryInterface.addIndex('tbl_product_attribute_values', ['attribute_id', 'value_number'], {
      name: 'idx_pav_attr_number',
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('tbl_product_attribute_values');
  },
};
