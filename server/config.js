require('dotenv').config({ path: __dirname + '/.env' });

module.exports = {
  port: process.env.PORT || 3000,
  sessionSecret: process.env.SESSION_SECRET || 'keg-dev-secret-change-me',
  dbPath: process.env.DB_PATH || __dirname + '/db/keg.db',
  mailchimp: {
    apiKey: process.env.MAILCHIMP_API_KEY || '',
    server: process.env.MAILCHIMP_SERVER_PREFIX || '',
    listId: process.env.MAILCHIMP_LIST_ID || '',
  },
  admin: {
    defaultUsername: process.env.ADMIN_USERNAME || 'admin',
    defaultPassword: process.env.ADMIN_PASSWORD || 'keg2026',
  },
  uploadDir: __dirname + '/uploads',
};
