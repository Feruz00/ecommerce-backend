'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tbl_orders', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      order_number: { type: Sequelize.STRING(30), allowNull: false },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'tbl_users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      status: {
        type: Sequelize.ENUM(
          'pending',
          'confirmed',
          'processing',
          'shipped',
          'delivered',
          'cancelled'
        ),
        allowNull: false,
        defaultValue: 'pending',
      },
      payment_status: {
        type: Sequelize.ENUM('pending', 'paid', 'failed', 'refunded'),
        allowNull: false,
        defaultValue: 'pending',
      },
      payment_method: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'cash',
      },
      subtotal: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      shipping_cost: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      discount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      total: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      shipping_address: { type: Sequelize.JSON, allowNull: true },
      note: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('tbl_orders', ['order_number'], {
      unique: true,
      name: 'uq_orders_number',
    });
    await queryInterface.addIndex('tbl_orders', ['user_id'], {
      name: 'idx_orders_user',
    });
    await queryInterface.addIndex('tbl_orders', ['status'], {
      name: 'idx_orders_status',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tbl_orders');
  },
};
