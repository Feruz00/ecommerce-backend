const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const AppError = require('../utils/appError');

const ALLOWED_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 15 * 1024 * 1024; // 15MB (compressed after upload)

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const entity = (req.body.entity_type || req.query.entity_type || 'misc').toLowerCase();
    const allowed = ['products', 'banners', 'categories', 'avatars', 'misc'];
    const folder = allowed.includes(entity) ? entity : 'misc';
    const dest = path.join(__dirname, '..', 'uploads', folder);
    ensureDir(dest);
    req.uploadFolder = folder;
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const name = `${uuidv4()}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Only image files are allowed (jpeg, png, webp, gif)', 400), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE, files: 10 },
});

/** Single image: field name "image" or "file" */
const uploadSingle = upload.single('image');

/** Multiple images: field name "images" */
const uploadMultiple = upload.array('images', 10);

/** Flexible: accept either single or multiple */
const uploadAny = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'images', maxCount: 10 },
  { name: 'file', maxCount: 1 },
]);

module.exports = {
  upload,
  uploadSingle,
  uploadMultiple,
  uploadAny,
  ALLOWED_MIME,
  MAX_SIZE,
};
