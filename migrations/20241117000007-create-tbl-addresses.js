'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tbl_addresses', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'tbl_users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      full_name: { type: Sequelize.STRING(150), allowNull: false },
      phone: { type: Sequelize.STRING(30), allowNull: false },
      city: { type: Sequelize.STRING(100), allowNull: false },
      district: { type: Sequelize.STRING(100), allowNull: true },
      street: { type: Sequelize.STRING(255), allowNull: false },
      is_default: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('tbl_addresses', ['user_id'], {
      name: 'idx_addresses_user',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tbl_addresses');
  },
};
