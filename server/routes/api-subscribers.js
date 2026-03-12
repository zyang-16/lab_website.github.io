const express = require('express');
const requireAuth = require('../middleware/auth');
const mailchimpService = require('../services/mailchimp');
const router = express.Router();

// POST /api/subscribers — public subscribe
router.post('/subscribers', async (req, res) => {
  const { email, name } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  try {
    // Check if already exists
    const existing = req.db.prepare('SELECT * FROM subscribers WHERE email = ?').get(email);
    if (existing && existing.status === 'subscribed') {
      return res.json({ ok: true, message: 'Already subscribed' });
    }

    // Add/update in local DB
    if (existing) {
      req.db.prepare('UPDATE subscribers SET status = ?, name = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?')
        .run('subscribed', name || existing.name, email);
    } else {
      req.db.prepare('INSERT INTO subscribers (email, name, status) VALUES (?, ?, ?)')
        .run(email, name || '', 'subscribed');
    }

    // Sync to Mailchimp
    const mcResult = await mailchimpService.addSubscriber(email, name);
    if (mcResult && mcResult.id) {
      req.db.prepare('UPDATE subscribers SET mailchimp_id = ? WHERE email = ?').run(mcResult.id, email);
    }

    res.json({ ok: true, message: 'Subscribed successfully' });
  } catch (err) {
    console.error('Subscribe error:', err.message);
    // Still succeed locally even if Mailchimp fails
    res.json({ ok: true, message: 'Subscribed successfully' });
  }
});

// DELETE /api/subscribers/:email — public unsubscribe
router.delete('/subscribers/:email', async (req, res) => {
  const { email } = req.params;
  const subscriber = req.db.prepare('SELECT * FROM subscribers WHERE email = ?').get(email);
  if (!subscriber) return res.status(404).json({ error: 'Subscriber not found' });

  req.db.prepare('UPDATE subscribers SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?')
    .run('unsubscribed', email);

  try {
    await mailchimpService.unsubscribe(email);
  } catch (err) {
    console.error('Mailchimp unsubscribe error:', err.message);
  }

  res.json({ ok: true, message: 'Unsubscribed' });
});

// GET /api/subscribers — admin only
router.get('/subscribers', requireAuth, (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const offset = (pageNum - 1) * limitNum;

  let where = [];
  const params = [];
  if (status) {
    where.push('status = ?');
    params.push(status);
  }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = req.db.prepare(`SELECT COUNT(*) as cnt FROM subscribers ${whereClause}`).get(...params).cnt;
  const subscribers = req.db.prepare(
    `SELECT * FROM subscribers ${whereClause} ORDER BY subscribed_at DESC LIMIT ? OFFSET ?`
  ).all(...params, limitNum, offset);

  res.json({
    subscribers,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
  });
});

// POST /api/subscribers/sync — sync from Mailchimp (admin)
router.post('/subscribers/sync', requireAuth, async (req, res) => {
  try {
    const members = await mailchimpService.getListMembers();
    if (!members) return res.json({ ok: true, synced: 0 });

    let synced = 0;
    for (const member of members) {
      const existing = req.db.prepare('SELECT id FROM subscribers WHERE email = ?').get(member.email_address);
      if (existing) {
        req.db.prepare('UPDATE subscribers SET status = ?, mailchimp_id = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?')
          .run(member.status === 'subscribed' ? 'subscribed' : 'unsubscribed', member.id, member.email_address);
      } else {
        req.db.prepare('INSERT INTO subscribers (email, name, status, mailchimp_id) VALUES (?, ?, ?, ?)')
          .run(member.email_address, member.merge_fields?.FNAME || '', member.status === 'subscribed' ? 'subscribed' : 'unsubscribed', member.id);
      }
      synced++;
    }

    res.json({ ok: true, synced });
  } catch (err) {
    console.error('Sync error:', err.message);
    res.status(500).json({ error: 'Sync failed: ' + err.message });
  }
});

module.exports = router;
