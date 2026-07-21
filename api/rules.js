// Vercel Serverless Function for /api/rules
// Uses /tmp file storage to persist rules across warm invocations
const fs = require('fs');
const path = require('path');

const RULES_FILE = '/tmp/securellm_rules.json';

function readRules() {
  try {
    if (fs.existsSync(RULES_FILE)) {
      return JSON.parse(fs.readFileSync(RULES_FILE, 'utf8'));
    }
  } catch (e) {
    console.warn('Failed to read rules file:', e.message);
  }
  return [];
}

function writeRules(rules) {
  try {
    fs.writeFileSync(RULES_FILE, JSON.stringify(rules), 'utf8');
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

  if (req.method === 'POST') {
    const ruleItem = req.body;
    if (ruleItem && ruleItem.patternText) {
      const rules = readRules();
      // Prevent duplicate rules
      const exists = rules.some(r => r.id === ruleItem.id);
      if (!exists) {
        rules.unshift(ruleItem);
        writeRules(rules);
      }
    }
    return res.status(200).json({ status: 'rule_saved', id: ruleItem ? ruleItem.id : null });
  }

  if (req.method === 'DELETE') {
    writeRules([]);
    return res.status(200).json({ status: 'cleared' });
  }

  // GET request - return all persisted rules
  const rules = readRules();
  return res.status(200).json(rules);
};
