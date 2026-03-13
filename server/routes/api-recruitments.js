const express = require('express');
const requireAuth = require('../middleware/auth');
const router = express.Router();

// GET /api/recruitments — public list with pagination & filtering
router.get('/recruitments', (req, res) => {
  const { type, active, featured, search, page = 1, limit = 20 } = req.query;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 20));
  const offset = (pageNum - 1) * limitNum;

  let where = [];
  const params = [];

  if (type) {
    where.push('position_type = ?');
    params.push(type);
  }
  if (active !== undefined) {
    where.push('is_active = ?');
    params.push(parseInt(active));
  }
  if (featured !== undefined) {
    where.push('is_featured = ?');
    params.push(parseInt(featured));
  }
  if (search) {
    where.push('(title LIKE ? OR description LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const total = req.db.prepare(`SELECT COUNT(*) as cnt FROM recruitments ${whereClause}`).get(...params).cnt;
  const recruitments = req.db.prepare(
    `SELECT id, title, position_type, description, contact_email, is_featured, is_active, created_at, updated_at
     FROM recruitments ${whereClause}
     ORDER BY is_featured DESC, created_at DESC
     LIMIT ? OFFSET ?`
  ).all(...params, limitNum, offset);

  res.json({
    recruitments,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum)
    }
  });
});

// GET /api/recruitments/:id — single recruitment
router.get('/recruitments/:id', (req, res) => {
  const recruitment = req.db.prepare('SELECT * FROM recruitments WHERE id = ?').get(req.params.id);
  if (!recruitment) return res.status(404).json({ error: 'Recruitment not found' });
  res.json(recruitment);
});

// POST /api/recruitments — create (admin)
router.post('/recruitments', requireAuth, (req, res) => {
  const { title, position_type, description, content_html, contact_email, is_featured, is_active } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });

  const result = req.db.prepare(
    `INSERT INTO recruitments (title, position_type, description, content_html, contact_email, is_featured, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    title,
    position_type || 'general',
    description || null,
    content_html || null,
    contact_email || null,
    is_featured ? 1 : 0,
    is_active !== undefined ? (is_active ? 1 : 0) : 1
  );

  res.json({ ok: true, id: result.lastInsertRowid });
});

// PUT /api/recruitments/:id — update (admin)
router.put('/recruitments/:id', requireAuth, (req, res) => {
  const recruitment = req.db.prepare('SELECT * FROM recruitments WHERE id = ?').get(req.params.id);
  if (!recruitment) return res.status(404).json({ error: 'Recruitment not found' });

  const { title, position_type, description, content_html, contact_email, is_featured, is_active } = req.body;

  req.db.prepare(
    `UPDATE recruitments SET title=?, position_type=?, description=?, content_html=?, contact_email=?, is_featured=?, is_active=?, updated_at=CURRENT_TIMESTAMP
     WHERE id=?`
  ).run(
    title || recruitment.title,
    position_type || recruitment.position_type,
    description !== undefined ? description : recruitment.description,
    content_html !== undefined ? content_html : recruitment.content_html,
    contact_email !== undefined ? contact_email : recruitment.contact_email,
    is_featured !== undefined ? (is_featured ? 1 : 0) : recruitment.is_featured,
    is_active !== undefined ? (is_active ? 1 : 0) : recruitment.is_active,
    req.params.id
  );

  res.json({ ok: true });
});

// DELETE /api/recruitments/:id — delete (admin)
router.delete('/recruitments/:id', requireAuth, (req, res) => {
  const result = req.db.prepare('DELETE FROM recruitments WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Recruitment not found' });
  res.json({ ok: true });
});

module.exports = router;
