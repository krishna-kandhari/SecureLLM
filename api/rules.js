// Vercel Serverless Function for /api/rules
let rulesStore = [];

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
      rulesStore.unshift(ruleItem);
    }
    return res.status(200).json({ status: 'rule_saved', id: ruleItem ? ruleItem.id : null });
  }

  // GET request - return active rules
  return res.status(200).json(rulesStore);
};
