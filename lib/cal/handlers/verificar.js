'use strict';

/**
 * GET /api/cal/verificar — troca o magic token (do e-mail) por uma sessão
 * (cookie httpOnly de 30 dias). Depois disso a escrita não depende mais do
 * link do assessor.
 */

const auth = require('../auth');

async function verificarAcesso({ magicToken }) {
  let payload;
  try {
    payload = auth.verificar(magicToken, 'magic');
  } catch {
    return { status: 401, body: { error: 'Link expirado ou inválido. Solicite um novo acesso.' } };
  }

  const sessao = auth.assinarSessao({ sid: payload.sid, email: payload.email });
  return {
    status: 200,
    body: { ok: true },
    setCookie: auth.cookieSessao(sessao),
  };
}

module.exports = { verificarAcesso };
