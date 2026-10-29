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

const crypto = require('crypto');

// Verified Groq Credentials & Single Working Model
function getVerifiedGroqKey() {
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim().length > 10) {
    return process.env.GROQ_API_KEY.trim();
  }
  try {
    const pass = "Krishna@3960";
    const ivHex = "9938953fabed86cb29d83637841173ba";
    const encHex = "57797a601a6df6aa9706f8f5091e0a8ae1db6f6ca4a396c78522845143bf9d424f79c8d661bbf01daff3474f216335d162bb5707937a6b472766348873e84d03";
    const key = crypto.createHash("sha256").update(pass).digest();
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let dec = decipher.update(Buffer.from(encHex, "hex"), null, "utf8");
    dec += decipher.final("utf8");
    return dec.trim();
  } catch (err) {
    console.error("Failed to decrypt server-side Groq key:", err.message);
    return "";
  }
}

const VERIFIED_GROQ_KEY = getVerifiedGroqKey();
const VERIFIED_MODEL = 'qwen/qwen3.8-27b';

// API Route: Live Model Status & Connectivity Check
app.get('/api/model-status', async (req, res) => {
  try {
    const upstream = await fetch('https://api.groq.com/openai/v1/models/' + VERIFIED_MODEL, {
      headers: { 'Authorization': `Bearer ${VERIFIED_GROQ_KEY}` }
    });
    if (upstream.ok) {
      const data = await upstream.json();
      return res.json({ status: 'connected', model: VERIFIED_MODEL, active: true, info: data });
    } else {
      return res.status(upstream.status).json({ status: 'error', code: upstream.status });
    }
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// API Route: Streaming Chat Proxy (Pipes SSE stream directly to browser)
app.post('/api/chat', async (req, res) => {
  const { messages, temperature, stream } = req.body || {};
  
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: { message: 'Missing or invalid messages array' } });
  }

  // Allow custom client key if provided in Authorization header, else use verified key
  const authHeader = req.headers['authorization'] || '';
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const activeKey = (tokenMatch && tokenMatch[1] && tokenMatch[1].trim().length > 10) 
    ? tokenMatch[1].trim() 
    : VERIFIED_GROQ_KEY;

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${activeKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: VERIFIED_MODEL,
        messages: messages,
        temperature: typeof temperature === 'number' ? temperature : 0.7,
        stream: stream !== false
      })
    });

    if (!groqRes.ok) {
      const errJson = await groqRes.json().catch(() => ({}));
      return res.status(groqRes.status).json(errJson);
    }

    if (stream === false) {
      const data = await groqRes.json();
      return res.json(data);
    }

    // Set streaming SSE headers
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    const reader = groqRes.body.getReader();

    req.on('close', () => {
      reader.cancel().catch(() => {});
    });

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();

  } catch (err) {
    console.error('Groq proxy error:', err);
    if (!res.headersSent) {
      res.status(502).json({ error: { message: `Backend Groq Gateway Error: ${err.message}` } });
    } else {
      res.end();
    }
  }
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
