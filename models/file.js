'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class File extends Model {
    static associate(models) {
      // Polymorphic: entity_type + entity_id
      // Product / Banner / Category / User reference files by id or by entity link
    }
  }

  File.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      original_name: { type: DataTypes.STRING(255), allowNull: false },
      filename: { type: DataTypes.STRING(255), allowNull: false },
      path: { type: DataTypes.STRING(500), allowNull: false },
      url: { type: DataTypes.STRING(500), allowNull: false },
      mime_type: { type: DataTypes.STRING(100), allowNull: true },
      size: { type: DataTypes.INTEGER, allowNull: true },
      disk: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'local' },
      alt: { type: DataTypes.STRING(255), allowNull: true },
      entity_type: { type: DataTypes.STRING(50), allowNull: true },
      entity_id: { type: DataTypes.STRING(50), allowNull: true },
      sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      is_primary: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    {
      sequelize,
      modelName: 'File',
      tableName: 'tbl_files',
      underscored: true,
    }
  );

  return File;
};
