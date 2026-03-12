const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

// POST /api/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const admin = req.db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  req.session.admin = { id: admin.id, username: admin.username };
  res.json({ ok: true, username: admin.username });
});

// POST /api/logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

// GET /api/me
router.get('/me', (req, res) => {
  if (req.session && req.session.admin) {
    return res.json({ loggedIn: true, username: req.session.admin.username });
  }
  res.json({ loggedIn: false });
});

module.exports = router;
