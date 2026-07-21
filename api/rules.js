// Vercel Serverless Function for /api/rules
// Uses /tmp file storage to persist rules and whitelists across warm invocations
const fs = require('fs');
const path = require('path');

const RULES_FILE = '/tmp/securellm_rules.json';

function readData() {
  try {
    if (fs.existsSync(RULES_FILE)) {
      const data = JSON.parse(fs.readFileSync(RULES_FILE, 'utf8'));
      if (Array.isArray(data)) {
        return { rules: data, whitelist: [] };
      }
      return { rules: data.rules || [], whitelist: data.whitelist || [] };
    }
  } catch (e) {
    console.warn('Failed to read rules file:', e.message);
  }
  return { rules: [], whitelist: [] };
}

function writeData(data) {
  try {
    fs.writeFileSync(RULES_FILE, JSON.stringify(data), 'utf8');
  } catch (e) {
    console.warn('Failed to write rules file:', e.message);
  }
}

module.exports = (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, apikey'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // PUT: Full overwrite sync from Admin (Handles unblocking / rule deletions / whitelist updates)
  if (req.method === 'PUT') {
    const payload = req.body || {};
    const updatedRules = Array.isArray(payload.rules) ? payload.rules : [];
    const updatedWhitelist = Array.isArray(payload.whitelist) ? payload.whitelist : [];
    
    writeData({ rules: updatedRules, whitelist: updatedWhitelist });
    return res.status(200).json({ status: 'synced', rulesCount: updatedRules.length, whitelistCount: updatedWhitelist.length });
  }

  // POST: Add new rule or sync payload
  if (req.method === 'POST') {
    const payload = req.body || {};
    
    // If full payload object is sent with rules & whitelist
    if (payload.rules || payload.whitelist) {
      const current = readData();
      const newRules = Array.isArray(payload.rules) ? payload.rules : current.rules;
      const newWhitelist = Array.isArray(payload.whitelist) ? payload.whitelist : current.whitelist;
      writeData({ rules: newRules, whitelist: newWhitelist });
      return res.status(200).json({ status: 'state_updated' });
    }

    // Single rule object sent
    if (payload.patternText) {
      const current = readData();
      const exists = current.rules.some(r => r.id === payload.id);
      if (!exists) {
        current.rules.unshift(payload);
        writeData(current);
      }
    }
    return res.status(200).json({ status: 'rule_saved', id: payload.id || null });
  }

  if (req.method === 'DELETE') {
    writeData({ rules: [], whitelist: [] });
    return res.status(200).json({ status: 'cleared' });
  }

  // GET: Return current rules and whitelist
  const current = readData();
  return res.status(200).json(current);
};
