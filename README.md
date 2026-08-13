# ProLotto - Funil de Vendas & Checkout IronPay

Clone de alta conversão do funil de vendas ProLotto com integração direta de pagamento via PIX da IronPay API.

## 🚀 Estrutura do Projeto

- `index.html`: Funil principal em Single Page Application (Quiz, Simulador Lotofácil/Mega-Sena, VSL Wistia com tempo de página de 6min47s para revelar o botão pulsante).
- `checkout.html`: Checkout estilo Amplo Pay (apenas PIX, sem solicitação de CPF no formulário, Order Bumps dinâmicos e confirmação em tempo real).
- `server.js`: Servidor Node.js backend integrado à API REST da IronPay, com gerador automático de CPF válido para aprovação instantânea das transações.
- Assets: `banner_top.png`, `banner_bottom.png`, `logo-prolotto.png`, `som-caixa-registradora.mp3`.

## ⚙️ Como Rodar Localmente

1. Certifique-se de ter o **Node.js** instalado.
2. Inicie o servidor:
   ```bash
   node server.js
   ```
3. Acesse no navegador:
   - **Checkout:** `http://localhost:3001/checkout.html`
   - **VSL / Funil:** `http://localhost:3001/`

## 🔑 Credenciais Configuradas

- **IronPay API Token:** `Z9DAYrt7sWMHnbN8gUvwBjeS8A6HcvJRChZ621XV1v54vegMWzQHmzlVgIfs`
- **Produto Principal (R$ 37,00):** `tf5cojgchg` (Oferta: `ow6ytcdbko`)
- **Order Bump 1 - Pesquisa Avançada (R$ 14,00):** `o1dqfp2fw5` (Oferta: `gnwutfixlv`)
- **Order Bump 2 - Estratégias de Bolão (R$ 14,00):** `f5pqccrjft` (Oferta: `f52elc7ob6`)
