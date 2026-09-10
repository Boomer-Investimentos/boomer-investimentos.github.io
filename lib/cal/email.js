'use strict';

/**
 * Envio do magic link via Resend (API REST, sem SDK — usa axios que já é dep).
 * Endurecido para os riscos de não usar o SDK:
 *   - Idempotency-Key: retry não gera e-mail duplicado;
 *   - 1 retry com backoff em 429/5xx;
 *   - erro estruturado (loga o corpo da Resend, nunca o link/token).
 * Mockado nos testes — sem teste próprio.
 */

const crypto = require('crypto');
const axios = require('axios');

const RESEND_URL = 'https://api.resend.com/emails';

function corpoHtml({ url, cliente }) {
  const nome = cliente ? ` ${cliente}` : '';
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1f2937">
      <p>Olá${nome},</p>
      <p>Use o link abaixo para acessar o seu <strong>Calendário Financeiro</strong>.
         Ele vale por 15 minutos e serve só para este acesso.</p>
      <p><a href="${url}"
            style="display:inline-block;padding:10px 18px;background:#0096FF;color:#fff;
                   border-radius:6px;text-decoration:none">Abrir meu calendário</a></p>
      <p style="color:#6b7280;font-size:13px">Se você não pediu este acesso, ignore este e-mail.</p>
    </div>`;
}

/** Chave de idempotência estável para a janela de validade do magic link. */
function chaveIdempotencia(to) {
  const janela = Math.floor(Date.now() / (15 * 60 * 1000)); // muda a cada 15 min
  return crypto.createHash('sha256').update(`${to}|${janela}`).digest('hex').slice(0, 32);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function enviarMagicLink({ to, url, cliente }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY ausente');
  const from = process.env.CAL_FROM_EMAIL || 'calendario@boomerinvestimentos.com.br';

  const payload = {
    from: `Boomer Investimentos <${from}>`,
    to: [to],
    subject: 'Seu acesso ao Calendário Financeiro',
    html: corpoHtml({ url, cliente }),
  };
  const config = {
    headers: { Authorization: `Bearer ${key}`, 'Idempotency-Key': chaveIdempotencia(to) },
    timeout: 15000,
  };

  for (let tentativa = 0; tentativa < 2; tentativa += 1) {
    try {
      await axios.post(RESEND_URL, payload, config);
      return;
    } catch (err) {
      const status = err.response && err.response.status;
      const recuperavel = status === 429 || (status >= 500 && status <= 599);
      if (recuperavel && tentativa === 0) {
        await sleep(400);
        continue;
      }
      const detalhe = err.response ? JSON.stringify(err.response.data) : err.message;
      throw new Error(`Resend falhou (status ${status || '?'}): ${detalhe}`);
    }
  }
}

module.exports = { enviarMagicLink };
