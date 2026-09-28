#!/usr/bin/env node
/**
 * Envia um e-mail real de magic link do Calendário Financeiro, via Resend.
 *
 * Uso:
 *   node --env-file=server/.env scripts/cal-test-email.mjs [to] [cliente]
 *
 * Defaults: to=petala@boomerinvestimentos.com.br, cliente="Pétala".
 * Precisa de CAL_JWT_SECRET e RESEND_API_KEY no ambiente (e idealmente
 * CAL_FROM_EMAIL=boomer@boomerinvestimentos.com.br já verificado no Resend).
 *
 * O sid usado é um placeholder ('TEST-EMAIL'), não uma planilha real: este
 * script testa só o envio do e-mail e o round-trip do token (auth.verificar),
 * não o fluxo completo — abrir o link vai falhar na busca da planilha/CONFIG,
 * já que 'TEST-EMAIL' não existe no Sheets.
 */

import auth from '../lib/cal/auth.js';
import email from '../lib/cal/email.js';

const to = process.argv[2] || 'petala@boomerinvestimentos.com.br';
const cliente = process.argv[3] || 'Pétala';

const faltando = ['CAL_JWT_SECRET', 'RESEND_API_KEY'].filter((k) => !process.env[k]);
if (faltando.length) {
  console.error(`variáveis ausentes: ${faltando.join(', ')}`);
  console.error('uso: node --env-file=server/.env scripts/cal-test-email.mjs [to] [cliente]');
  process.exit(1);
}

const base = (process.env.CAL_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
const magic = auth.assinarMagic({ sid: 'TEST-EMAIL', email: to });
const url = `${base}/calendario?t=${magic}`;

try {
  await email.enviarMagicLink({ to, url, cliente });
  console.log(`e-mail enviado para ${to} (from: ${process.env.CAL_FROM_EMAIL || 'calendario@boomerinvestimentos.com.br'})`);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
