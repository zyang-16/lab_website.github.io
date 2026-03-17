const express = require('express');
const requireAuth = require('../middleware/auth');
const router = express.Router();

// GET /api/publications — public list with pagination & filtering
router.get('/publications', (req, res) => {
  const { category, year, search, page = 1, limit = 50 } = req.query;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));
  const offset = (pageNum - 1) * limitNum;

  let where = ['is_active = 1'];
  const params = [];

  if (category) {
    where.push('category = ?');
    params.push(category);
  }
  if (year) {
    where.push('year = ?');
    params.push(parseInt(year));
  }
  if (search) {
    where.push('(title LIKE ? OR authors LIKE ? OR venue LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const total = req.db.prepare(`SELECT COUNT(*) as cnt FROM publications ${whereClause}`).get(...params).cnt;
  const publications = req.db.prepare(
    `SELECT id, title, authors, venue, year, category, venue_tier, pdf_url, code_url, sort_order
     FROM publications ${whereClause}
     ORDER BY year DESC, sort_order ASC
     LIMIT ? OFFSET ?`
  ).all(...params, limitNum, offset);

  res.json({
    publications,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum)
    }
  });
});

// GET /api/publications/:id — single publication
router.get('/publications/:id', (req, res) => {
  const pub = req.db.prepare('SELECT * FROM publications WHERE id = ?').get(req.params.id);
  if (!pub) return res.status(404).json({ error: 'Publication not found' });
  res.json(pub);
});

// POST /api/publications — create (admin)
router.post('/publications', requireAuth, (req, res) => {
  const { title, authors, venue, year, category, venue_tier, pdf_url, code_url, sort_order } = req.body;
  if (!title || !authors) return res.status(400).json({ error: 'Title and authors required' });

  const result = req.db.prepare(
    `INSERT INTO publications (title, authors, venue, year, category, venue_tier, pdf_url, code_url, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    title, authors, venue || '', parseInt(year) || new Date().getFullYear(),
    category || 'conference', venue_tier || 'top-tier',
    pdf_url || '', code_url || '', parseInt(sort_order) || 0
  );

  res.json({ ok: true, id: result.lastInsertRowid });
});

// PUT /api/publications/:id — update (admin)
router.put('/publications/:id', requireAuth, (req, res) => {
  const pub = req.db.prepare('SELECT * FROM publications WHERE id = ?').get(req.params.id);
  if (!pub) return res.status(404).json({ error: 'Publication not found' });

  const { title, authors, venue, year, category, venue_tier, pdf_url, code_url, sort_order, is_active } = req.body;

  req.db.prepare(
    `UPDATE publications SET title=?, authors=?, venue=?, year=?, category=?, venue_tier=?, pdf_url=?, code_url=?, sort_order=?, is_active=?, updated_at=CURRENT_TIMESTAMP
     WHERE id=?`
  ).run(
    title || pub.title,
    authors || pub.authors,
    venue !== undefined ? venue : pub.venue,
    year !== undefined ? parseInt(year) : pub.year,
    category || pub.category,
    venue_tier || pub.venue_tier,
    pdf_url !== undefined ? pdf_url : pub.pdf_url,
    code_url !== undefined ? code_url : pub.code_url,
    sort_order !== undefined ? parseInt(sort_order) : pub.sort_order,
    is_active !== undefined ? (is_active ? 1 : 0) : pub.is_active,
    req.params.id
  );

  res.json({ ok: true });
});

// DELETE /api/publications/:id — delete (admin)
router.delete('/publications/:id', requireAuth, (req, res) => {
  const result = req.db.prepare('DELETE FROM publications WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Publication not found' });
  res.json({ ok: true });
});

module.exports = router;
