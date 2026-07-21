// Vercel Serverless Function for /api/logs
// Uses /tmp file storage to persist logs across warm invocations
const fs = require('fs');
const path = require('path');

const LOGS_FILE = '/tmp/securellm_logs.json';

function readLogs() {
  try {
    if (fs.existsSync(LOGS_FILE)) {
      return JSON.parse(fs.readFileSync(LOGS_FILE, 'utf8'));
    }
  } catch (e) {
    console.warn('Failed to read logs file:', e.message);
  }
  return [];
}

function writeLogs(logs) {
  try {
    fs.writeFileSync(LOGS_FILE, JSON.stringify(logs), 'utf8');
  } catch (e) {
    console.warn('Failed to write logs file:', e.message);
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
    const logItem = req.body;
    if (logItem && logItem.prompt) {
      const logs = readLogs();
      logs.unshift(logItem);
      if (logs.length > 2000) {
        logs.length = 2000;
      }
      writeLogs(logs);
    }
    return res.status(200).json({ status: 'success', id: logItem ? logItem.id : null });
  }

  if (req.method === 'DELETE') {
    writeLogs([]);
    return res.status(200).json({ status: 'cleared' });
  }

  // GET request - return all persisted logs
  const logs = readLogs();
  return res.status(200).json(logs);
};
