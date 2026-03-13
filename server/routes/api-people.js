const express = require('express');
const requireAuth = require('../middleware/auth');
const router = express.Router();

// GET /api/people — public list with pagination & filtering
router.get('/people', (req, res) => {
  const { role, active, search, page = 1, limit = 50 } = req.query;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
  const offset = (pageNum - 1) * limitNum;

  let where = [];
  const params = [];

  if (role) {
    where.push('role = ?');
    params.push(role);
  }
  if (active !== undefined) {
    where.push('is_active = ?');
    params.push(parseInt(active));
  }
  if (search) {
    where.push('(name LIKE ? OR email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const total = req.db.prepare(`SELECT COUNT(*) as cnt FROM people ${whereClause}`).get(...params).cnt;
  const people = req.db.prepare(
    `SELECT * FROM people ${whereClause}
     ORDER BY sort_order ASC, name ASC
     LIMIT ? OFFSET ?`
  ).all(...params, limitNum, offset);

  res.json({
    people,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum)
    }
  });
});

// GET /api/people/:id — single person
router.get('/people/:id', (req, res) => {
  const person = req.db.prepare('SELECT * FROM people WHERE id = ?').get(req.params.id);
  if (!person) return res.status(404).json({ error: 'Person not found' });
  res.json(person);
});

// POST /api/people — create (admin)
router.post('/people', requireAuth, (req, res) => {
  const { name, title, role, photo, photo_position, link, supervisor, email, bio, year_start, year_end, sort_order, is_active } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });

  const result = req.db.prepare(
    `INSERT INTO people (name, title, role, photo, photo_position, link, supervisor, email, bio, year_start, year_end, sort_order, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    name,
    title || null,
    role || 'phd',
    photo || null,
    photo_position || null,
    link || null,
    supervisor || null,
    email || null,
    bio || null,
    year_start || null,
    year_end || null,
    sort_order || 0,
    is_active !== undefined ? (is_active ? 1 : 0) : 1
  );

  res.json({ ok: true, id: result.lastInsertRowid });
});

// PUT /api/people/:id — update (admin)
router.put('/people/:id', requireAuth, (req, res) => {
  const person = req.db.prepare('SELECT * FROM people WHERE id = ?').get(req.params.id);
  if (!person) return res.status(404).json({ error: 'Person not found' });

  const { name, title, role, photo, photo_position, link, supervisor, email, bio, year_start, year_end, sort_order, is_active } = req.body;

  req.db.prepare(
    `UPDATE people SET name=?, title=?, role=?, photo=?, photo_position=?, link=?, supervisor=?, email=?, bio=?, year_start=?, year_end=?, sort_order=?, is_active=?, updated_at=CURRENT_TIMESTAMP
     WHERE id=?`
  ).run(
    name || person.name,
    title !== undefined ? title : person.title,
    role || person.role,
    photo !== undefined ? photo : person.photo,
    photo_position !== undefined ? photo_position : person.photo_position,
    link !== undefined ? link : person.link,
    supervisor !== undefined ? supervisor : person.supervisor,
    email !== undefined ? email : person.email,
    bio !== undefined ? bio : person.bio,
    year_start !== undefined ? year_start : person.year_start,
    year_end !== undefined ? year_end : person.year_end,
    sort_order !== undefined ? sort_order : person.sort_order,
    is_active !== undefined ? (is_active ? 1 : 0) : person.is_active,
    req.params.id
  );

  res.json({ ok: true });
});

// DELETE /api/people/:id — delete (admin)
router.delete('/people/:id', requireAuth, (req, res) => {
  const result = req.db.prepare('DELETE FROM people WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Person not found' });
  res.json({ ok: true });
});

module.exports = router;
