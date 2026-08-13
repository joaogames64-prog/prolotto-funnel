const CONFIG = {
  IRONPAY_API_TOKEN: process.env.IRONPAY_API_TOKEN || "Z9DAYrt7sWMHnbN8gUvwBjeS8A6HcvJRChZ621XV1v54vegMWzQHmzlVgIfs"
};

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Extract hash from query parameter (set by vercel.json rewrite)
    const { hash } = req.query;

    if (!hash) {
      return res.status(400).json({ error: 'Transaction hash is required' });
    }

    const apiToken = CONFIG.IRONPAY_API_TOKEN;
    const checkUrl = `https://api.ironpayapp.com.br/api/public/v1/transactions/${hash}?api_token=${encodeURIComponent(apiToken)}`;

    const statusResp = await fetch(checkUrl, {
      headers: { 'Accept': 'application/json' }
    });

    const statusData = await statusResp.json();
    return res.status(200).json(statusData);

  } catch (e) {
    console.error('[CHECK STATUS ERROR]', e);
    return res.status(500).json({ error: e.message });
  }
};
