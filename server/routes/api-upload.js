const express = require('express');
const multer = require('multer');
const path = require('path');
const requireAuth = require('../middleware/auth');
const config = require('../config');
const router = express.Router();

const storage = multer.diskStorage({
  destination: config.uploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8) + ext;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('Only image files allowed'));
    }
  }
});

// POST /api/upload
router.post('/upload', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ ok: true, url: '/uploads/' + req.file.filename });
});

module.exports = router;
