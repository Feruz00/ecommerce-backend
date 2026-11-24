const path = require("path");
const fs = require("fs");
const { File } = require("../models");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const { Op } = require("sequelize");
const { compressImage } = require("../utils/imageCompress");

const baseUrl = () =>
  process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`;

const buildFileUrl = (folder, filename) => `/uploads/${folder}/${filename}`;

/**
 * Upload one or more images → compress → create tbl_files records
 * Body: entity_type?, entity_id?, alt?, is_primary?, skip_compress?
 * Files: image | images | file
 */
exports.upload = catchAsync(async (req, res, next) => {
  const files = [];
  if (req.file) files.push(req.file);
  if (req.files) {
    if (Array.isArray(req.files)) files.push(...req.files);
    else {
      Object.values(req.files).forEach((arr) => files.push(...arr));
    }
  }

  if (!files.length) {
    return next(new AppError("No file uploaded", 400));
  }

  const entity_type = req.body.entity_type || req.query.entity_type || null;
  const entity_id = req.body.entity_id || req.query.entity_id || null;
  const alt = req.body.alt || null;
  const is_primary =
    req.body.is_primary === "true" || req.body.is_primary === true;
  const skipCompress =
    req.body.skip_compress === "true" || req.body.skip_compress === true;

  const folder = req.uploadFolder || entity_type || "misc";
  const records = [];
  const compressionStats = [];

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    let finalPath = f.path;
    let finalFilename = f.filename;
    let finalMime = f.mimetype;
    let finalSize = f.size;
    let meta = {
      compressed: false,
      original_size: f.size,
      width: null,
      height: null,
      saved_percent: 0,
    };

    // Compress unless skipped
    if (!skipCompress) {
      try {
        const result = await compressImage(f, folder);
        finalPath = result.path;
        finalFilename = result.filename;
        finalMime = result.mimetype;
        finalSize = result.size;
        meta = result;
        compressionStats.push({
          original: result.original_size,
          compressed: result.size,
          saved_percent: result.saved_percent,
          width: result.width,
          height: result.height,
        });
      } catch (err) {
        console.error(
          "Image compression failed, keeping original:",
          err.message,
        );
        compressionStats.push({ error: err.message, kept_original: true });
      }
    }

    const url = buildFileUrl(folder, finalFilename);

    if (is_primary && i === 0 && entity_type && entity_id) {
      await File.update(
        { is_primary: false },
        {
          where: {
            entity_type,
            entity_id: String(entity_id),
            is_primary: true,
          },
        },
      );
    }

    const record = await File.create({
      original_name: f.originalname,
      filename: finalFilename,
      path: finalPath,
      url,
      mime_type: finalMime,
      size: finalSize,
      disk: "local",
      alt: alt || f.originalname,
      entity_type,
      entity_id: entity_id ? String(entity_id) : null,
      sort_order: i,
      is_primary: is_primary && i === 0,
    });

    const json = record.toJSON();
    json.compression = meta;
    records.push(json);
  }

  res.status(201).json({
    status: "success",
    results: records.length,
    data: {
      files: records,
      file: records[0],
      compression: compressionStats,
    },
  });
});

/** List files, optional filter by entity */
exports.list = catchAsync(async (req, res) => {
  const { entity_type, entity_id, page = 1, limit = 30 } = req.query;
  const where = {};
  if (entity_type) where.entity_type = entity_type;
  if (entity_id) where.entity_id = String(entity_id);

  const { count, rows } = await File.findAndCountAll({
    where,
    order: [["created_at", "DESC"]],
    limit: parseInt(limit),
    offset: (parseInt(page) - 1) * parseInt(limit),
  });

  res.json({
    status: "success",
    total: count,
    page: parseInt(page),
    data: { files: rows },
  });
});

/** Get single file meta */
exports.getOne = catchAsync(async (req, res, next) => {
  const file = await File.findByPk(req.params.id);
  if (!file) return next(new AppError("File not found", 404));
  res.json({ status: "success", data: { file } });
});

/** Delete file from DB + disk */
exports.remove = catchAsync(async (req, res, next) => {
  const file = await File.findByPk(req.params.id);
  if (!file) return next(new AppError("File not found", 404));

  // Delete from disk if local
  if (file.disk === "local" && file.path && fs.existsSync(file.path)) {
    try {
      fs.unlinkSync(file.path);
    } catch (e) {
      console.error("Failed to delete file from disk:", e.message);
    }
  }

  await file.destroy();
  res.status(204).send();
});

/** Attach existing file to an entity (or re-assign) */
exports.attach = catchAsync(async (req, res, next) => {
  const { entity_type, entity_id, is_primary } = req.body;
  const file = await File.findByPk(req.params.id);
  if (!file) return next(new AppError("File not found", 404));

  if (is_primary && entity_type && entity_id) {
    await File.update(
      { is_primary: false },
      {
        where: { entity_type, entity_id: String(entity_id), is_primary: true },
      },
    );
  }

  file.entity_type = entity_type || file.entity_type;
  file.entity_id = entity_id ? String(entity_id) : file.entity_id;
  if (is_primary !== undefined) file.is_primary = !!is_primary;
  await file.save();

  res.json({ status: "success", data: { file } });
});

/** Bulk delete */
exports.bulkDelete = catchAsync(async (req, res) => {
  const { ids } = req.body;
  if (!ids?.length)
    return res.json({ status: "success", message: "Nothing to delete" });

  const files = await File.findAll({ where: { id: { [Op.in]: ids } } });
  for (const file of files) {
    if (file.disk === "local" && file.path && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch (e) {}
    }
  }
  await File.destroy({ where: { id: { [Op.in]: ids } } });
  res.json({ status: "success", message: `Deleted ${files.length} files` });
});
