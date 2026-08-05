const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files
app.use(express.static(path.join(__dirname)));

// Memory fallbacks for serverless environments (Vercel)
let inMemoryLogs = [];
let inMemoryRules = [];

const IS_VERCEL = !!process.env.VERCEL;
const DATA_DIR = IS_VERCEL ? '/tmp' : path.join(__dirname, 'data');
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');
const RULES_FILE = path.join(DATA_DIR, 'rules.json');

function readJSONFile(filePath, memoryFallback) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {
    console.warn(`Read failed for ${filePath}:`, e.message);
  }
  return memoryFallback;
}

function writeJSONFile(filePath, data, memoryStore) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.warn(`Write to disk failed for ${filePath} (read-only environment):`, e.message);
  }
}

// API Route: Post new telemetry log entry from user
app.post('/api/logs', (req, res) => {
  const logItem = req.body;
  if (!logItem || !logItem.prompt) {
    return res.status(400).json({ error: 'Invalid log payload' });
  }

  const logs = readJSONFile(LOGS_FILE, inMemoryLogs);
  logs.unshift(logItem);
  
  if (logs.length > 2000) {
    logs.pop();
  }

  inMemoryLogs = logs;
  writeJSONFile(LOGS_FILE, logs);
  res.json({ status: 'success', id: logItem.id });
});

// API Route: Get all audit logs for Admin Dashboard
app.get('/api/logs', (req, res) => {
  const logs = readJSONFile(LOGS_FILE, inMemoryLogs);
  res.json(logs);
});

// API Route: Delete/Clear logs
app.delete('/api/logs', (req, res) => {
  inMemoryLogs = [];
  writeJSONFile(LOGS_FILE, []);
  res.json({ status: 'cleared' });
});

// API Route: Get active adaptive security rules
app.get('/api/rules', (req, res) => {
  const data = readJSONFile(RULES_FILE, inMemoryRules);
  if (Array.isArray(data)) {
    return res.json({ rules: data, whitelist: [] });
  }
  res.json({ rules: data.rules || [], whitelist: data.whitelist || [] });
});

// API Route: Save or sync adaptive rules & whitelist
app.post('/api/rules', (req, res) => {
  const payload = req.body || {};
  
  if (payload.rules || payload.whitelist) {
    const current = readJSONFile(RULES_FILE, { rules: [], whitelist: [] });
    const updated = {
      rules: Array.isArray(payload.rules) ? payload.rules : (current.rules || []),
      whitelist: Array.isArray(payload.whitelist) ? payload.whitelist : (current.whitelist || [])
    };
    inMemoryRules = updated;
    writeJSONFile(RULES_FILE, updated);
    return res.json({ status: 'state_updated' });
  }

  if (payload.patternText) {
    const current = readJSONFile(RULES_FILE, { rules: [], whitelist: [] });
    const rulesList = Array.isArray(current) ? current : (current.rules || []);
    const exists = rulesList.some(r => r.id === payload.id);
    if (!exists) {
      rulesList.unshift(payload);
    }
    const updated = { rules: rulesList, whitelist: current.whitelist || [] };
    inMemoryRules = updated;
    writeJSONFile(RULES_FILE, updated);
    return res.json({ status: 'rule_saved', id: payload.id });
  }

  return res.status(400).json({ error: 'Invalid rule payload' });
});

// API Route: Full state overwrite (Admin updates / unblocks / whitelisting)
app.put('/api/rules', (req, res) => {
  const payload = req.body || {};
  const updatedRules = Array.isArray(payload.rules) ? payload.rules : [];
  const updatedWhitelist = Array.isArray(payload.whitelist) ? payload.whitelist : [];
  
  const updated = { rules: updatedRules, whitelist: updatedWhitelist };
  inMemoryRules = updated;
  writeJSONFile(RULES_FILE, updated);
  res.json({ status: 'synced', rulesCount: updatedRules.length, whitelistCount: updatedWhitelist.length });
});

// API Route: Clear custom rules
app.delete('/api/rules', (req, res) => {
  inMemoryRules = { rules: [], whitelist: [] };
  writeJSONFile(RULES_FILE, inMemoryRules);
  res.json({ status: 'cleared' });
});

// Serve frontend for all unmatched routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`  Secure LLM Production Server running on port ${PORT}`);
    console.log(`  Live Telemetry API: http://localhost:${PORT}/api/logs`);
    console.log(`====================================================`);
  });
}
