const express = require('express');
const requireAuth = require('../middleware/auth');
const mailchimpService = require('../services/mailchimp');
const router = express.Router();

// GET /api/newsletters — admin list
router.get('/newsletters', requireAuth, (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 10));
  const offset = (pageNum - 1) * limitNum;

  let where = [];
  const params = [];
  if (status) {
    where.push('status = ?');
    params.push(status);
  }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = req.db.prepare(`SELECT COUNT(*) as cnt FROM newsletters ${whereClause}`).get(...params).cnt;
  const newsletters = req.db.prepare(
    `SELECT * FROM newsletters ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, limitNum, offset);

  res.json({
    newsletters,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
  });
});

// GET /api/newsletters/:id
router.get('/newsletters/:id', requireAuth, (req, res) => {
  const nl = req.db.prepare('SELECT * FROM newsletters WHERE id = ?').get(req.params.id);
  if (!nl) return res.status(404).json({ error: 'Newsletter not found' });
  res.json(nl);
});

// POST /api/newsletters — create
router.post('/newsletters', requireAuth, (req, res) => {
  const { subject, body_html } = req.body;
  if (!subject) return res.status(400).json({ error: 'Subject required' });

  const result = req.db.prepare(
    'INSERT INTO newsletters (subject, body_html, status) VALUES (?, ?, ?)'
  ).run(subject, body_html || '', 'draft');

  res.json({ ok: true, id: result.lastInsertRowid });
});

// PUT /api/newsletters/:id — update
router.put('/newsletters/:id', requireAuth, (req, res) => {
  const nl = req.db.prepare('SELECT * FROM newsletters WHERE id = ?').get(req.params.id);
  if (!nl) return res.status(404).json({ error: 'Newsletter not found' });
  if (nl.status === 'sent') return res.status(400).json({ error: 'Cannot edit sent newsletter' });

  const { subject, body_html } = req.body;
  req.db.prepare(
    'UPDATE newsletters SET subject=?, body_html=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).run(subject || nl.subject, body_html !== undefined ? body_html : nl.body_html, req.params.id);

  res.json({ ok: true });
});

// DELETE /api/newsletters/:id
router.delete('/newsletters/:id', requireAuth, (req, res) => {
  const nl = req.db.prepare('SELECT * FROM newsletters WHERE id = ?').get(req.params.id);
  if (!nl) return res.status(404).json({ error: 'Newsletter not found' });
  if (nl.status === 'sent') return res.status(400).json({ error: 'Cannot delete sent newsletter' });

  req.db.prepare('DELETE FROM newsletters WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// POST /api/newsletters/:id/send — send immediately
router.post('/newsletters/:id/send', requireAuth, async (req, res) => {
  const nl = req.db.prepare('SELECT * FROM newsletters WHERE id = ?').get(req.params.id);
  if (!nl) return res.status(404).json({ error: 'Newsletter not found' });
  if (nl.status === 'sent') return res.status(400).json({ error: 'Already sent' });

  try {
    const campaignId = await mailchimpService.createAndSendCampaign(nl.subject, nl.body_html);
    req.db.prepare(
      'UPDATE newsletters SET status=?, mailchimp_campaign_id=?, sent_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?'
    ).run('sent', campaignId || '', req.params.id);

    res.json({ ok: true, campaignId });
  } catch (err) {
    console.error('Send newsletter error:', err.message);
    res.status(500).json({ error: 'Failed to send: ' + err.message });
  }
});

// POST /api/newsletters/:id/schedule — schedule for later
router.post('/newsletters/:id/schedule', requireAuth, async (req, res) => {
  const nl = req.db.prepare('SELECT * FROM newsletters WHERE id = ?').get(req.params.id);
  if (!nl) return res.status(404).json({ error: 'Newsletter not found' });
  if (nl.status === 'sent') return res.status(400).json({ error: 'Already sent' });

  const { scheduled_at } = req.body;
  if (!scheduled_at) return res.status(400).json({ error: 'scheduled_at required' });

  try {
    const campaignId = await mailchimpService.createAndScheduleCampaign(nl.subject, nl.body_html, scheduled_at);
    req.db.prepare(
      'UPDATE newsletters SET status=?, mailchimp_campaign_id=?, scheduled_at=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
    ).run('scheduled', campaignId || '', scheduled_at, req.params.id);

    res.json({ ok: true, campaignId, scheduled_at });
  } catch (err) {
    console.error('Schedule newsletter error:', err.message);
    res.status(500).json({ error: 'Failed to schedule: ' + err.message });
  }
});

module.exports = router;
