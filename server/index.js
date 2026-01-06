const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
// Render automatically sets PORT, so we use it or default to 5000
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Use persistent data directory for uploads (Railway Volume), otherwise use local
const dataDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.DATA_DIR || __dirname;
const uploadsDir = path.join(dataDir, 'uploads');

// Create uploads directory if it doesn't exist
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded images
app.use('/uploads', express.static(uploadsDir));

// Import routes
const productsRoutes = require('./routes/products');
const settingsRoutes = require('./routes/settings');
const authRoutes = require('./routes/auth');

// Serve static public assets if available
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

// Routes
app.use('/api/products', productsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/auth', authRoutes);

// Basic health/root responses (serve landing if exists)
app.get('/', (req, res) => {
  const landing = path.join(publicDir, 'index.html');
  if (fs.existsSync(landing)) {
    return res.sendFile(landing);
  }
  res.json({ status: 'ok', message: 'API is running' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Serve static files in production when a built client exists
const clientDistPath = path.join(__dirname, '../client/dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else if (process.env.NODE_ENV === 'production') {
  console.warn('Client build not found; serving API only.');
}

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});


