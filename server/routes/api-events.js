const express = require('express');
const requireAuth = require('../middleware/auth');
const router = express.Router();

// GET /api/events — public list
router.get('/events', (req, res) => {
  const { upcoming, type, page = 1, limit = 10 } = req.query;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 10));
  const offset = (pageNum - 1) * limitNum;

  let where = [];
  const params = [];

  if (upcoming !== undefined) {
    where.push('is_upcoming = ?');
    params.push(upcoming === '1' ? 1 : 0);
  }
  if (type) {
    where.push('event_type = ?');
    params.push(type);
  }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = req.db.prepare(`SELECT COUNT(*) as cnt FROM events ${whereClause}`).get(...params).cnt;
  const events = req.db.prepare(
    `SELECT * FROM events ${whereClause} ORDER BY event_date DESC LIMIT ? OFFSET ?`
  ).all(...params, limitNum, offset);

  res.json({
    events,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
  });
});

// GET /api/events/:id
router.get('/events/:id', (req, res) => {
  const event = req.db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  res.json(event);
});

// POST /api/events — create (admin)
router.post('/events', requireAuth, (req, res) => {
  const { title, description, speaker, location, event_date, event_end_date, event_type, cover_image, is_upcoming } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });

  const result = req.db.prepare(
    `INSERT INTO events (title, description, speaker, location, event_date, event_end_date, event_type, cover_image, is_upcoming)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(title, description || '', speaker || '', location || '', event_date || null, event_end_date || null, event_type || 'seminar', cover_image || '', is_upcoming !== undefined ? (is_upcoming ? 1 : 0) : 1);

  res.json({ ok: true, id: result.lastInsertRowid });
});

// PUT /api/events/:id — update (admin)
router.put('/events/:id', requireAuth, (req, res) => {
  const event = req.db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });

  const { title, description, speaker, location, event_date, event_end_date, event_type, cover_image, is_upcoming } = req.body;

  req.db.prepare(
    `UPDATE events SET title=?, description=?, speaker=?, location=?, event_date=?, event_end_date=?, event_type=?, cover_image=?, is_upcoming=?, updated_at=CURRENT_TIMESTAMP
     WHERE id=?`
  ).run(
    title || event.title,
    description !== undefined ? description : event.description,
    speaker !== undefined ? speaker : event.speaker,
    location !== undefined ? location : event.location,
    event_date || event.event_date,
    event_end_date !== undefined ? event_end_date : event.event_end_date,
    event_type || event.event_type,
    cover_image !== undefined ? cover_image : event.cover_image,
    is_upcoming !== undefined ? (is_upcoming ? 1 : 0) : event.is_upcoming,
    req.params.id
  );

  res.json({ ok: true });
});

// DELETE /api/events/:id — delete (admin)
router.delete('/events/:id', requireAuth, (req, res) => {
  const result = req.db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Event not found' });
  res.json({ ok: true });
});

module.exports = router;
