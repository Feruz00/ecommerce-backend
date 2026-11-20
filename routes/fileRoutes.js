const express = require('express');
const fileController = require('../controllers/fileController');
const { protect, restrictTo } = require('../middleware/auth');
const { uploadAny, uploadSingle, uploadMultiple } = require('../middleware/upload');

const router = express.Router();

// Public: list/get not needed publicly for private uploads; keep admin-only

router.use(protect);
router.use(restrictTo('admin', 'manager'));

// Upload single or multiple images
// POST /api/files/upload  (multipart: image | images, fields: entity_type, entity_id, alt, is_primary)
router.post('/upload', (req, res, next) => {
  uploadAny(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ status: 'fail', message: 'File too large (max 15MB before compression)' });
      }
      return res.status(400).json({ status: 'fail', message: err.message || 'Upload error' });
    }
    next();
  });
}, fileController.upload);

router.get('/', fileController.list);
router.get('/:id', fileController.getOne);
router.patch('/:id/attach', fileController.attach);
router.delete('/:id', fileController.remove);
router.post('/bulk-delete', fileController.bulkDelete);

module.exports = router;
