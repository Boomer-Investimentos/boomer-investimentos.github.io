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

// Tokens do Design System oficial da Boomer (tema Escuro), mesmos valores de
// src/Pages/Calendario/CalendarioPage.module.css — ver nota lá sobre a paleta.
const LOGO_URL = 'https://www.boomerinvestimentos.com.br/boomer-logo-email.png';

function corpoHtml({ url, cliente }) {
  const nome = cliente ? ` ${cliente}` : '';
  return `
    <style>
      @media screen {
        @import url('https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@400;600;700;800&display=swap');
      }
    </style>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#141C31;">
      <tr>
        <td align="center" style="padding:0;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
            style="width:100%;max-width:600px;background-color:#141C31;">
            <tr>
              <td style="padding:32px 32px 24px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="left" valign="middle">
                      <img src="${LOGO_URL}" width="220" alt="Boomer"
                        style="display:block;border:0;outline:none;text-decoration:none;height:auto;width:220px;">
                    </td>
                    <td align="right" valign="middle"
                      style="font-family:'Nunito Sans',Arial,sans-serif;font-size:12px;line-height:17px;color:#AA8A78;">
                      Assessoria de Investimentos<br>
                      Belo Horizonte / MG
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td height="1" style="height:1px;line-height:1px;font-size:1px;background-color:#25345A;">&nbsp;</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;font-family:'Nunito Sans',Arial,sans-serif;color:#EDE6E2;">
                <p style="margin:0 0 16px 0;font-size:16px;line-height:24px;">Olá${nome},</p>
                <p style="margin:0 0 24px 0;font-size:15px;line-height:22px;color:#EDE6E2;">
                  Use o link abaixo para acessar o seu <strong>Calendário Financeiro</strong>.
                  Ele vale por 15 minutos e serve só para este acesso.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="border-radius:8px;background-color:#DA7742;">
                      <a href="${url}"
                        style="display:inline-block;padding:12px 24px;font-family:'Nunito Sans',Arial,sans-serif;
                               font-size:15px;font-weight:700;color:#141C31;text-decoration:none;border-radius:8px;">
                        Abrir meu calendário
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:24px 0 0 0;font-size:13px;line-height:19px;color:#AA8A78;">
                  Se você não pediu este acesso, ignore este e-mail.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
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
