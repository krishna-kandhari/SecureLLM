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
  const rules = readJSONFile(RULES_FILE, inMemoryRules);
  res.json(rules);
});

// API Route: Save or add new adaptive rule from admin decision
app.post('/api/rules', (req, res) => {
  const ruleItem = req.body;
  if (!ruleItem || !ruleItem.patternText) {
    return res.status(400).json({ error: 'Invalid rule payload' });
  }

  const rules = readJSONFile(RULES_FILE, inMemoryRules);
  rules.unshift(ruleItem);
  inMemoryRules = rules;
  writeJSONFile(RULES_FILE, rules);

  res.json({ status: 'rule_saved', id: ruleItem.id });
});

// Serve frontend for all unmatched routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  Secure LLM Production Server running on port ${PORT}`);
  console.log(`  Live Telemetry API: http://localhost:${PORT}/api/logs`);
  console.log(`====================================================`);
});
