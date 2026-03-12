const express = require('express');
const requireAuth = require('../middleware/auth');
const router = express.Router();

// Helper: generate slug from title
function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// GET /api/articles — public list with pagination & filtering
router.get('/articles', (req, res) => {
  const { type, category, search, page = 1, limit = 10 } = req.query;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 10));
  const offset = (pageNum - 1) * limitNum;

  let where = ['is_published = 1'];
  const params = [];

  if (type) {
    where.push('type = ?');
    params.push(type);
  }
  if (category) {
    where.push('category = ?');
    params.push(category);
  }
  if (search) {
    where.push('(title LIKE ? OR excerpt LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  // Admin sees all (including unpublished)
  if (req.session && req.session.admin) {
    where = where.filter(w => w !== 'is_published = 1');
  }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const total = req.db.prepare(`SELECT COUNT(*) as cnt FROM articles ${whereClause}`).get(...params).cnt;
  const articles = req.db.prepare(
    `SELECT id, title, slug, excerpt, cover_image, category, type, is_published, published_at, created_at
     FROM articles ${whereClause}
     ORDER BY published_at DESC, created_at DESC
     LIMIT ? OFFSET ?`
  ).all(...params, limitNum, offset);

  res.json({
    articles,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum)
    }
  });
});

// GET /api/articles/:slug — single article
router.get('/articles/:slug', (req, res) => {
  const article = req.db.prepare('SELECT * FROM articles WHERE slug = ?').get(req.params.slug);
  if (!article) return res.status(404).json({ error: 'Article not found' });
  res.json(article);
});

// POST /api/articles — create (admin)
router.post('/articles', requireAuth, (req, res) => {
  const { title, excerpt, content, cover_image, category, type, is_published } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });

  const slug = slugify(title) + '-' + Date.now().toString(36);
  const published_at = is_published ? new Date().toISOString() : null;

  const result = req.db.prepare(
    `INSERT INTO articles (title, slug, excerpt, content, cover_image, category, type, is_published, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(title, slug, excerpt || '', content || '', cover_image || '', category || 'general', type || 'news', is_published ? 1 : 0, published_at);

  res.json({ ok: true, id: result.lastInsertRowid, slug });
});

// PUT /api/articles/:id — update (admin)
router.put('/articles/:id', requireAuth, (req, res) => {
  const article = req.db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
  if (!article) return res.status(404).json({ error: 'Article not found' });

  const { title, excerpt, content, cover_image, category, type, is_published } = req.body;

  let published_at = article.published_at;
  if (is_published && !article.is_published) {
    published_at = new Date().toISOString();
  }

  req.db.prepare(
    `UPDATE articles SET title=?, excerpt=?, content=?, cover_image=?, category=?, type=?, is_published=?, published_at=?, updated_at=CURRENT_TIMESTAMP
     WHERE id=?`
  ).run(
    title || article.title,
    excerpt !== undefined ? excerpt : article.excerpt,
    content !== undefined ? content : article.content,
    cover_image !== undefined ? cover_image : article.cover_image,
    category || article.category,
    type || article.type,
    is_published !== undefined ? (is_published ? 1 : 0) : article.is_published,
    published_at,
    req.params.id
  );

  res.json({ ok: true });
});

// DELETE /api/articles/:id — delete (admin)
router.delete('/articles/:id', requireAuth, (req, res) => {
  const result = req.db.prepare('DELETE FROM articles WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Article not found' });
  res.json({ ok: true });
});

module.exports = router;
