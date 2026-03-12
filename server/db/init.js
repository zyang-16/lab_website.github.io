const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const config = require('../config');
const { init } = require('./database');

async function main() {
  const db = await init();

  // Run schema
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  // sql.js needs statements run separately
  const statements = schema.split(';').filter(s => s.trim());
  for (const stmt of statements) {
    db.exec(stmt + ';');
  }

  // Seed admin
  const existing = db.prepare('SELECT id FROM admins WHERE username = ?').get(config.admin.defaultUsername);
  if (!existing) {
    const hash = bcrypt.hashSync(config.admin.defaultPassword, 10);
    db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run(config.admin.defaultUsername, hash);
    console.log(`Admin user "${config.admin.defaultUsername}" created.`);
  } else {
    console.log('Admin user already exists, skipping seed.');
  }

  // Seed sample articles
  const articleCount = db.prepare('SELECT COUNT(*) as cnt FROM articles').get();
  if (articleCount.cnt === 0) {
    const articles = [
      ['AgentBeats Phase 1 Deadline & New Benchmarks', 'agentbeats-phase-1', 'This week, we wrap up the first phase of the AgentBeats coding competition.', '<p>This week, we wrap up the first phase of the AgentBeats coding competition. We also introduce a new set of benchmarks for evaluating multi-agent collaboration in dynamic environments.</p>', 'research', 'weekly', '2026-01-14'],
      ['Prize Updates & Custom Tracks for OpenDev', 'prize-updates-opendev', 'Detailed breakdown of the prize pool for the new Custom Track.', '<p>Detailed breakdown of the prize pool for the new Custom Track. Also, we discuss the implications of multi-agent collaboration in cybersecurity environments and what it means for safety.</p>', 'general', 'weekly', '2026-01-07'],
      ['2025: A Year of Agentic Innovation', '2025-year-review', 'Looking back at our major milestones.', '<p>Looking back at our major milestones: The launch of ChatGLM-4, the first Agentic AI MOOC, and over 50 top-tier conference papers accepted.</p>', 'general', 'weekly', '2025-12-30'],
      ['GLM-5: From Vibe Coding to Agentic Engineering', 'glm-5-release', 'We are proud to announce the release of GLM-5.', '<p>We are proud to announce the release of GLM-5, targeting complex systems engineering and long-horizon agentic tasks.</p>', 'research', 'news', '2026-02-12'],
      ['GLM-4.7: Advancing the Coding Capability', 'glm-4-7', 'We introduce the GLM-4.7, your new coding partner.', '<p>We introduce the GLM-4.7, your new coding partner, with Core Coding, Vibe Coding, Tool Using, and Complex Reasoning.</p>', 'research', 'news', '2025-12-12'],
    ];
    for (const a of articles) {
      db.prepare('INSERT INTO articles (title, slug, excerpt, content, category, type, is_published, published_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)').run(...a);
    }
    console.log('Sample articles seeded.');
  }

  // Seed sample events
  const eventCount = db.prepare('SELECT COUNT(*) as cnt FROM events').get();
  if (eventCount.cnt === 0) {
    const events = [
      ['AI for Science Seminar', 'Discussion on AI applications in scientific discovery.', 'Prof. Jie Tang', 'FIT 1-308', '2026-04-01 14:00:00', 'seminar', 1],
      ['ChatGLM Workshop', 'Hands-on workshop on deploying ChatGLM models.', 'KEG Team', 'Online', '2026-03-20 10:00:00', 'workshop', 1],
    ];
    for (const e of events) {
      db.prepare('INSERT INTO events (title, description, speaker, location, event_date, event_type, is_upcoming) VALUES (?, ?, ?, ?, ?, ?, ?)').run(...e);
    }
    console.log('Sample events seeded.');
  }

  console.log('Database initialized successfully at:', config.dbPath);
}

main().catch(err => {
  console.error('Init failed:', err);
  process.exit(1);
});
