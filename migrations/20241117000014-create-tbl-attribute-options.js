'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tbl_attribute_options', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      attribute_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'tbl_attributes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      value: { type: Sequelize.STRING(150), allowNull: false },
      color_hex: { type: Sequelize.STRING(20), allowNull: true },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      translations: { type: Sequelize.JSON, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('tbl_attribute_options', ['attribute_id', 'value'], {
      unique: true,
      name: 'uq_attr_opt_value',
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('tbl_attribute_options');
  },
};
