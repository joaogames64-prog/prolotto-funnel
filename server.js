const http = require('http');
const fs = require('fs');
const path = require('path');

// --- IRONPAY CONFIGURATION ---
const CONFIG = {
  IRONPAY_API_TOKEN: process.env.IRONPAY_API_TOKEN || "Z9DAYrt7sWMHnbN8gUvwBjeS8A6HcvJRChZ621XV1v54vegMWzQHmzlVgIfs",
  MAIN_PRODUCT: {
    product_hash: "tf5cojgchg",
    offer_hash: "ow6ytcdbko",
    title: "ProLotto",
    price: 3700
  },
  ORDER_BUMP_1: {
    product_hash: "o1dqfp2fw5",
    offer_hash: "gnwutfixlv",
    title: "Prolotto - pesquisa avançada",
    price: 1400
  },
  ORDER_BUMP_2: {
    product_hash: "f5pqccrjft",
    offer_hash: "f52elc7ob6",
    title: "ProLotto - Análise de Estratégias de Bolões",
    price: 1400
  },
  PORT: process.env.PORT || 3001
};

// --- VALID BRAZILIAN CPF GENERATOR ---
function generateValidCPF() {
  const rnd = () => Math.floor(Math.random() * 9);
  let n = Array.from({ length: 9 }, rnd);

  let d1 = n.reduce((acc, val, idx) => acc + val * (10 - idx), 0);
  d1 = 11 - (d1 % 11);
  if (d1 >= 10) d1 = 0;

  let d2 = [...n, d1].reduce((acc, val, idx) => acc + val * (11 - idx), 0);
  d2 = 11 - (d2 % 11);
  if (d2 >= 10) d2 = 0;

  return [...n, d1, d2].join('');
}

// --- HTTP SERVER ---
const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // API Endpoint: Create PIX Transaction
  if (req.method === 'POST' && url.pathname === '/api/create-pix-transaction') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const { name, email, phone, bump1, bump2, bump3 } = payload;

        if (!name || !email || !phone) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Nome, E-mail e Telefone são obrigatórios.' }));
          return;
        }

        // Generate a real valid CPF for this transaction
        const validCpf = generateValidCPF();

        // Build cart array and sum amount in cents
        const cart = [
          {
            product_hash: CONFIG.MAIN_PRODUCT.product_hash,
            title: CONFIG.MAIN_PRODUCT.title,
            price: CONFIG.MAIN_PRODUCT.price,
            quantity: 1,
            operation_type: 1,
            tangible: false
          }
        ];

        let totalAmountCents = CONFIG.MAIN_PRODUCT.price;

        if (bump1) {
          cart.push({
            product_hash: CONFIG.ORDER_BUMP_1.product_hash,
            title: CONFIG.ORDER_BUMP_1.title,
            price: CONFIG.ORDER_BUMP_1.price,
            quantity: 1,
            operation_type: 1,
            tangible: false
          });
          totalAmountCents += CONFIG.ORDER_BUMP_1.price;
        }

        if (bump2) {
          cart.push({
            product_hash: CONFIG.ORDER_BUMP_2.product_hash,
            title: CONFIG.ORDER_BUMP_2.title,
            price: CONFIG.ORDER_BUMP_2.price,
            quantity: 1,
            operation_type: 1,
            tangible: false
          });
          totalAmountCents += CONFIG.ORDER_BUMP_2.price;
        }

        // Extract all tracking parameters
        const trackingKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'src', 'sck', 'fbclid', 'gclid', 'click_id', 'lwtrk', 'sub1', 'sub2', 'sub3', 'sub4', 'sub5'];
        const trackingData = {};
        const customFields = [];

        trackingKeys.forEach(k => {
          const val = payload[k] || (payload.utmData && payload.utmData[k]);
          if (val && typeof val === 'string' && val.trim() !== '') {
            const cleanVal = val.trim();
            trackingData[k] = cleanVal;
            customFields.push({
              display_name: k.toUpperCase(),
              variable_name: k,
              value: cleanVal
            });
          }
        });

        const ironpayPayload = {
          amount: totalAmountCents,
          offer_hash: CONFIG.MAIN_PRODUCT.offer_hash,
          payment_method: "pix",
          customer: {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            phone_number: phone.replace(/\D/g, ''),
            document: validCpf,
            ...trackingData
          },
          cart: cart,
          expire_in_days: 1,
          transaction_origin: "api",
          ...trackingData,
          metadata: Object.keys(trackingData).length > 0 ? trackingData : undefined,
          tracking: Object.keys(trackingData).length > 0 ? trackingData : undefined,
          utm: Object.keys(trackingData).length > 0 ? trackingData : undefined,
          custom_fields: customFields.length > 0 ? customFields : undefined
        };

        console.log('[IRONPAY PAYLOAD ALL FIELDS]:', JSON.stringify(ironpayPayload, null, 2));

        const apiToken = CONFIG.IRONPAY_API_TOKEN;

        console.log(`[IRONPAY PIX ORDER] Name: ${name} | Email: ${email} | Phone: ${phone} | CPF: ${validCpf} | Items: ${cart.length} | Total: R$ ${(totalAmountCents / 100).toFixed(2)}`);

        // Real Production call to IronPay API
        const apiUrl = `https://api.ironpayapp.com.br/api/public/v1/transactions?api_token=${encodeURIComponent(apiToken)}`;
        const ironResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(ironpayPayload)
        });

        const ironData = await ironResponse.json();

        if (ironResponse.ok || ironResponse.status === 201) {
          const pixCode = ironData.pix_code || ironData.copy_paste || (ironData.pix ? ironData.pix.code : '');
          const qrCodeUrl = ironData.pix_qr_code || ironData.qr_code_base64 || (ironData.pix ? ironData.pix.qr_code_url : `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pixCode)}`);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            generated_cpf: validCpf,
            transaction_hash: ironData.hash || ironData.transaction_hash,
            status: ironData.status || "pending",
            amount: totalAmountCents,
            pix: {
              code: pixCode,
              qr_code_url: qrCodeUrl
            },
            data: ironData
          }));
        } else {
          console.error('[IRONPAY API ERROR]', ironData);
          res.writeHead(ironResponse.status || 400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: ironData.message || 'Erro ao processar transação com a IronPay',
            details: ironData
          }));
        }

      } catch (err) {
        console.error('[SERVER ERROR]', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erro interno no servidor' }));
      }
    });
    return;
  }

  // API Endpoint: Check Status
  if (req.method === 'GET' && url.pathname.startsWith('/api/check-status/')) {
    const hash = url.pathname.replace('/api/check-status/', '');
    const apiToken = CONFIG.IRONPAY_API_TOKEN;

    try {
      const checkUrl = `https://api.ironpayapp.com.br/api/public/v1/transactions/${hash}?api_token=${encodeURIComponent(apiToken)}`;
      const statusResp = await fetch(checkUrl, {
        headers: { 'Accept': 'application/json' }
      });
      const statusData = await statusResp.json();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(statusData));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // Serve Static Files (checkout.html, index.html, images)
  let filePath = path.join(__dirname, url.pathname === '/' ? 'index.html' : url.pathname);
  if (url.pathname === '/checkout' || url.pathname === '/checkout.html') {
    filePath = path.join(__dirname, 'checkout.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.mp3': 'audio/mpeg',
    '.json': 'application/json'
  };

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(CONFIG.PORT, () => {
  console.log(`🚀 ProLotto IronPay Server running at http://localhost:${CONFIG.PORT}/checkout.html`);
});
