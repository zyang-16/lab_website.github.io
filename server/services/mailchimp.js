const mailchimp = require('@mailchimp/mailchimp_marketing');
const config = require('../config');

// Initialize Mailchimp client
if (config.mailchimp.apiKey && config.mailchimp.server) {
  mailchimp.setConfig({
    apiKey: config.mailchimp.apiKey,
    server: config.mailchimp.server,
  });
}

function isConfigured() {
  return !!(config.mailchimp.apiKey && config.mailchimp.server && config.mailchimp.listId);
}

async function addSubscriber(email, name) {
  if (!isConfigured()) {
    console.log('[Mailchimp] Not configured, skipping addSubscriber');
    return null;
  }

  try {
    const response = await mailchimp.lists.addListMember(config.mailchimp.listId, {
      email_address: email,
      status: 'subscribed',
      merge_fields: { FNAME: name || '' },
    });
    return response;
  } catch (err) {
    // If already subscribed, update instead
    if (err.status === 400 && err.response?.body?.title === 'Member Exists') {
      const md5 = require('crypto').createHash('md5').update(email.toLowerCase()).digest('hex');
      const response = await mailchimp.lists.updateListMember(config.mailchimp.listId, md5, {
        status: 'subscribed',
      });
      return response;
    }
    throw err;
  }
}

async function unsubscribe(email) {
  if (!isConfigured()) {
    console.log('[Mailchimp] Not configured, skipping unsubscribe');
    return null;
  }

  const md5 = require('crypto').createHash('md5').update(email.toLowerCase()).digest('hex');
  return await mailchimp.lists.updateListMember(config.mailchimp.listId, md5, {
    status: 'unsubscribed',
  });
}

async function getListMembers() {
  if (!isConfigured()) {
    console.log('[Mailchimp] Not configured, skipping getListMembers');
    return [];
  }

  const response = await mailchimp.lists.getListMembersInfo(config.mailchimp.listId, {
    count: 1000,
    status: 'subscribed',
  });
  return response.members || [];
}

async function createAndSendCampaign(subject, htmlContent) {
  if (!isConfigured()) {
    console.log('[Mailchimp] Not configured, skipping campaign send');
    return null;
  }

  // Create campaign
  const campaign = await mailchimp.campaigns.create({
    type: 'regular',
    recipients: { list_id: config.mailchimp.listId },
    settings: {
      subject_line: subject,
      from_name: 'Tsinghua KEG',
      reply_to: 'keg@tsinghua.edu.cn',
    },
  });

  // Set content
  await mailchimp.campaigns.setContent(campaign.id, {
    html: htmlContent,
  });

  // Send
  await mailchimp.campaigns.send(campaign.id);
  return campaign.id;
}

async function createAndScheduleCampaign(subject, htmlContent, scheduleTime) {
  if (!isConfigured()) {
    console.log('[Mailchimp] Not configured, skipping campaign schedule');
    return null;
  }

  const campaign = await mailchimp.campaigns.create({
    type: 'regular',
    recipients: { list_id: config.mailchimp.listId },
    settings: {
      subject_line: subject,
      from_name: 'Tsinghua KEG',
      reply_to: 'keg@tsinghua.edu.cn',
    },
  });

  await mailchimp.campaigns.setContent(campaign.id, {
    html: htmlContent,
  });

  await mailchimp.campaigns.schedule(campaign.id, {
    schedule_time: scheduleTime,
  });

  return campaign.id;
}

module.exports = {
  addSubscriber,
  unsubscribe,
  getListMembers,
  createAndSendCampaign,
  createAndScheduleCampaign,
  isConfigured,
};
