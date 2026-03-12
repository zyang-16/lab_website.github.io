const cron = require('node-cron');
const { getSync, save } = require('../db/database');
const mailchimpService = require('./mailchimp');

// Archive expired events — every day at 1:00 AM
cron.schedule('0 1 * * *', () => {
  console.log('[Scheduler] Archiving expired events...');
  const db = getSync();
  if (!db) return;
  try {
    const result = db.prepare(
      "UPDATE events SET is_upcoming = 0, updated_at = CURRENT_TIMESTAMP WHERE is_upcoming = 1 AND event_date < datetime('now')"
    ).run();
    if (result.changes > 0) {
      console.log('[Scheduler] Archived ' + result.changes + ' expired events.');
    }
  } catch (err) {
    console.error('[Scheduler] Archive error:', err.message);
  }
});

// Sync Mailchimp subscribers — every day at 3:00 AM
cron.schedule('0 3 * * *', async () => {
  console.log('[Scheduler] Syncing Mailchimp subscribers...');
  if (!mailchimpService.isConfigured()) {
    console.log('[Scheduler] Mailchimp not configured, skipping sync.');
    return;
  }

  const db = getSync();
  if (!db) return;
  try {
    const members = await mailchimpService.getListMembers();
    let synced = 0;
    for (const member of members) {
      const existing = db.prepare('SELECT id FROM subscribers WHERE email = ?').get(member.email_address);
      if (existing) {
        db.prepare('UPDATE subscribers SET status = ?, mailchimp_id = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?')
          .run(member.status === 'subscribed' ? 'subscribed' : 'unsubscribed', member.id, member.email_address);
      } else {
        db.prepare('INSERT INTO subscribers (email, name, status, mailchimp_id) VALUES (?, ?, ?, ?)')
          .run(member.email_address, member.merge_fields?.FNAME || '', member.status === 'subscribed' ? 'subscribed' : 'unsubscribed', member.id);
      }
      synced++;
    }
    console.log('[Scheduler] Synced ' + synced + ' subscribers from Mailchimp.');
  } catch (err) {
    console.error('[Scheduler] Sync error:', err.message);
  }
});

// Check scheduled newsletters — every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  const db = getSync();
  if (!db) return;
  try {
    const pending = db.prepare(
      "SELECT * FROM newsletters WHERE status = 'scheduled' AND scheduled_at <= datetime('now')"
    ).all();

    for (const nl of pending) {
      if (nl.mailchimp_campaign_id) continue;

      try {
        const campaignId = await mailchimpService.createAndSendCampaign(nl.subject, nl.body_html);
        db.prepare(
          'UPDATE newsletters SET status = ?, mailchimp_campaign_id = ?, sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).run('sent', campaignId || '', nl.id);
        console.log('[Scheduler] Sent newsletter #' + nl.id + ': "' + nl.subject + '"');
      } catch (err) {
        console.error('[Scheduler] Failed to send newsletter #' + nl.id + ':', err.message);
      }
    }
  } catch (err) {
    console.error('[Scheduler] Newsletter check error:', err.message);
  }
});

console.log('[Scheduler] Cron jobs initialized.');
