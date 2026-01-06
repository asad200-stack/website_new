const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const { verifyToken } = require('./auth');

// Configure multer for logo upload
// Use persistent data directory (Railway Volume) if available
const dataDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.DATA_DIR || path.join(__dirname, '..');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(dataDir, 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, 'logo' + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Get all settings
router.get('/', (req, res) => {
  db.all('SELECT key, value FROM settings', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    const settings = {};
    rows.forEach(row => {
      settings[row.key] = row.value;
    });
    res.json(settings);
  });
});

// Get single setting
router.get('/:key', (req, res) => {
  db.get('SELECT value FROM settings WHERE key = ?', [req.params.key], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    res.json({ key: req.params.key, value: row.value });
  });
});

// Update settings (protected - admin only)
router.put('/', verifyToken, (req, res, next) => {
  upload.single('logo')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message })
    next()
  })
}, (req, res) => {
  const updates = req.body;
  
  // Handle logo upload
  if (req.file) {
    // Delete old logo if exists
    const dataDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.DATA_DIR || path.join(__dirname, '..');
    db.get('SELECT value FROM settings WHERE key = ?', ['logo'], (err, row) => {
      if (row && row.value) {
        const oldLogoPath = path.join(dataDir, row.value);
        if (fs.existsSync(oldLogoPath)) {
          fs.unlinkSync(oldLogoPath);
        }
      }
    });
    
    updates.logo = `/uploads/${req.file.filename}`;
  }

  // Update each setting
  const promises = Object.keys(updates).map(key => {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
        [key, updates[key]],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  });

  Promise.all(promises)
    .then(() => {
      res.json({ message: 'Settings updated successfully' });
    })
    .catch((err) => {
      res.status(500).json({ error: err.message });
    });
});

module.exports = router;


