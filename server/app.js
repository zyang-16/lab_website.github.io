const express = require('express');
const session = require('express-session');
const path = require('path');
const config = require('./config');
const fs = require('fs');
const { init, getSync } = require('./db/database');

// Ensure uploads directory exists
if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

async function startServer() {
  // Initialize database
  await init();
  console.log('Database loaded.');

  const app = express();

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
  }));

  // Make DB available to routes
  app.use((req, res, next) => {
    req.db = getSync();
    next();
  });

  // Static files: uploads
  app.use('/uploads', express.static(config.uploadDir));

  // Admin static files
  app.use('/admin', express.static(path.join(__dirname, 'admin')));

  // Main website static files
  app.use(express.static(path.join(__dirname, '..')));

  // API routes
  app.use('/api', require('./routes/auth'));
  app.use('/api', require('./routes/api-articles'));
  app.use('/api', require('./routes/api-events'));
  app.use('/api', require('./routes/api-subscribers'));
  app.use('/api', require('./routes/api-newsletters'));
  app.use('/api', require('./routes/api-people'));
  app.use('/api', require('./routes/api-recruitments'));
  app.use('/api', require('./routes/api-upload'));

  // Start scheduler
  require('./services/scheduler');

  // Error handler
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
  });

  app.listen(config.port, () => {
    console.log(`KEG server running at http://localhost:${config.port}`);
    console.log(`Admin panel: http://localhost:${config.port}/admin/`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
