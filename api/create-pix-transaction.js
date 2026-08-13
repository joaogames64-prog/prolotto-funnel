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
  ORDER_BUMP_3: {
    product_hash: "am8eyy3wrb",
    title: "ProLotto - Números Pelo WhatsApp",
    price: 1400
  }
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

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, email, phone, bump1, bump2, bump3 } = req.body;

    if (!name || !email || !phone) {
      return res.status(400).json({ error: 'Nome, E-mail e Telefone são obrigatórios.' });
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

    if (bump3) {
      cart.push({
        product_hash: CONFIG.ORDER_BUMP_3.product_hash,
        title: CONFIG.ORDER_BUMP_3.title,
        price: CONFIG.ORDER_BUMP_3.price,
        quantity: 1,
        operation_type: 1,
        tangible: false
      });
      totalAmountCents += CONFIG.ORDER_BUMP_3.price;
    }

    const ironpayPayload = {
      amount: totalAmountCents,
      offer_hash: CONFIG.MAIN_PRODUCT.offer_hash,
      payment_method: "pix",
      customer: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone_number: phone.replace(/\D/g, ''),
        document: validCpf
      },
      cart: cart,
      expire_in_days: 1,
      transaction_origin: "api"
    };

    const apiToken = CONFIG.IRONPAY_API_TOKEN;
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

    if (ironResponse.ok || ironResponse.status === 201 || ironData.hash || (ironData.pix && (ironData.pix.pix_qr_code || ironData.pix.pix_url))) {
      const pixCode = (ironData.pix && ironData.pix.pix_qr_code) || 
                      ironData.pix_code || 
                      ironData.pix_qr_code || 
                      (ironData.data && ironData.data.pix && ironData.data.pix.pix_qr_code) || 
                      '';

      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pixCode)}`;

      return res.status(200).json({
        success: true,
        generated_cpf: validCpf,
        transaction_hash: ironData.hash || ironData.transaction_hash || (ironData.data && ironData.data.hash),
        status: ironData.payment_status || ironData.status || "waiting_payment",
        amount: totalAmountCents,
        pix: {
          code: pixCode,
          qr_code_url: qrCodeUrl
        },
        data: ironData
      });
    } else {
      return res.status(ironResponse.status || 400).json({
        success: false,
        error: ironData.message || (ironData.errors && JSON.stringify(ironData.errors)) || 'Erro ao processar transação com a IronPay',
        details: ironData
      });
    }

  } catch (err) {
    console.error('[SERVER ERROR]', err);
    return res.status(500).json({ error: 'Erro interno no servidor' });
  }
};
