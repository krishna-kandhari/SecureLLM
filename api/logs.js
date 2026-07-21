// Vercel Serverless Function for /api/logs
let logsStore = [];

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
      logsStore.unshift(logItem);
      if (logsStore.length > 2000) {
        logsStore.pop();
      }
    }
    return res.status(200).json({ status: 'success', id: logItem ? logItem.id : null });
  }

  if (req.method === 'DELETE') {
    logsStore = [];
    return res.status(200).json({ status: 'cleared' });
  }

  // GET request - return all logs
  return res.status(200).json(logsStore);
};
