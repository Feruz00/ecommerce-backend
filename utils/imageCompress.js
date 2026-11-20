const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

/**
 * Compression presets by entity type
 * maxWidth / maxHeight — resize if larger (keeps aspect ratio)
 * quality — JPEG/WebP quality 1–100
 * format — output format: 'jpeg' | 'webp' | 'png' | 'auto'
 */
const PRESETS = {
  products: { maxWidth: 1200, maxHeight: 1200, quality: 82, format: 'webp' },
  banners: { maxWidth: 1920, maxHeight: 800, quality: 80, format: 'webp' },
  categories: { maxWidth: 600, maxHeight: 600, quality: 80, format: 'webp' },
  avatars: { maxWidth: 400, maxHeight: 400, quality: 85, format: 'webp' },
  misc: { maxWidth: 1600, maxHeight: 1600, quality: 80, format: 'webp' },
};

const EXT_MAP = {
  jpeg: '.jpg',
  jpg: '.jpg',
  webp: '.webp',
  png: '.png',
};

/**
 * Compress a single image file on disk.
 * Replaces the original file with a compressed version (new filename if format changes).
 *
 * @param {object} file - multer file object { path, filename, originalname, mimetype, size, destination }
 * @param {string} entityType - products | banners | categories | avatars | misc
 * @returns {Promise<object>} updated file meta { path, filename, mimetype, size, original_size, compressed }
 */
async function compressImage(file, entityType = 'misc') {
  const preset = PRESETS[entityType] || PRESETS.misc;
  const originalPath = file.path;
  const originalSize = file.size || (fs.existsSync(originalPath) ? fs.statSync(originalPath).size : 0);

  // Skip non-images or gif (keep animated gifs as-is)
  if (file.mimetype === 'image/gif') {
    return {
      path: originalPath,
      filename: file.filename,
      mimetype: file.mimetype,
      size: originalSize,
      original_size: originalSize,
      compressed: false,
      width: null,
      height: null,
    };
  }

  let pipeline = sharp(originalPath, { failOn: 'none' }).rotate(); // auto-orient from EXIF

  const meta = await pipeline.metadata();
  const width = meta.width || 0;
  const height = meta.height || 0;

  // Resize only if larger than limits
  if (width > preset.maxWidth || height > preset.maxHeight) {
    pipeline = pipeline.resize({
      width: preset.maxWidth,
      height: preset.maxHeight,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  // Choose output format
  let outFormat = preset.format;
  if (outFormat === 'auto') {
    outFormat = meta.hasAlpha ? 'png' : 'webp';
  }
  // PNG with no alpha can still be webp; keep png only if source has alpha and we want lossless-ish
  if (outFormat === 'png' && !meta.hasAlpha) {
    outFormat = 'webp';
  }

  if (outFormat === 'webp') {
    pipeline = pipeline.webp({ quality: preset.quality, effort: 4 });
  } else if (outFormat === 'jpeg' || outFormat === 'jpg') {
    pipeline = pipeline.jpeg({ quality: preset.quality, mozjpeg: true });
  } else if (outFormat === 'png') {
    pipeline = pipeline.png({ compressionLevel: 8, quality: preset.quality });
  }

  const ext = EXT_MAP[outFormat] || '.webp';
  const dir = path.dirname(originalPath);
  const newFilename = `${uuidv4()}${ext}`;
  const newPath = path.join(dir, newFilename);

  await pipeline.toFile(newPath);

  // Remove original if different path
  if (newPath !== originalPath && fs.existsSync(originalPath)) {
    try {
      fs.unlinkSync(originalPath);
    } catch (e) {
      console.warn('Could not remove original upload:', e.message);
    }
  }

  const newSize = fs.statSync(newPath).size;
  const outMeta = await sharp(newPath).metadata();

  return {
    path: newPath,
    filename: newFilename,
    mimetype: `image/${outFormat === 'jpg' ? 'jpeg' : outFormat}`,
    size: newSize,
    original_size: originalSize,
    compressed: true,
    width: outMeta.width,
    height: outMeta.height,
    saved_bytes: Math.max(0, originalSize - newSize),
    saved_percent: originalSize > 0 ? Math.round((1 - newSize / originalSize) * 100) : 0,
  };
}

/**
 * Compress multiple multer files sequentially
 */
async function compressImages(files, entityType = 'misc') {
  const results = [];
  for (const file of files) {
    results.push(await compressImage(file, entityType));
  }
  return results;
}

module.exports = {
  compressImage,
  compressImages,
  PRESETS,
};
