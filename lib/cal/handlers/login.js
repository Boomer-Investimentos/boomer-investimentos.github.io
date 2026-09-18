'use strict';

/**
 * POST /api/cal/login — recebe o link do assessor (`s`) + e-mail digitado
 * pelo cliente, confere contra CONFIG!Email_Cliente e dispara o magic link.
 * Nunca revela se o link é válido ou se o e-mail bate — mensagem genérica,
 * pra não virar oráculo de e-mails de cliente.
 */

const auth = require('../auth');
const sheets = require('../sheets');
const schema = require('../schema');
const email = require('../email');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MENSAGEM_GENERICA = 'Se o e-mail estiver correto, enviamos um link de acesso.';

async function pedirAcesso({ linkToken, email: emailDigitado }) {
  if (!EMAIL_RE.test(String(emailDigitado || '').trim())) {
    return { status: 400, body: { error: 'Informe um e-mail válido.' } };
  }

  let sid;
  try {
    sid = auth.verificar(linkToken, 'link').sid;
  } catch {
    return { status: 401, body: { error: 'Link de acesso inválido.' } };
  }

  const configValues = await sheets.getValues(sid, 'CONFIG!A1:C50');
  const config = schema.parseConfig(configValues);
  const emailNorm = schema.norm(emailDigitado);

  if (!config.emailCliente || emailNorm !== config.emailCliente) {
    // Mesma resposta de sucesso — não confirma/nega e-mail cadastrado.
    return { status: 200, body: { ok: true, mensagem: MENSAGEM_GENERICA } };
  }

  const magic = auth.assinarMagic({ sid, email: emailNorm });
  const base = String(process.env.CAL_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const url = `${base}/calendario?t=${magic}`;
  await email.enviarMagicLink({ to: emailNorm, url, cliente: config.cliente });

  return { status: 200, body: { ok: true, mensagem: MENSAGEM_GENERICA } };
}

module.exports = { pedirAcesso };
