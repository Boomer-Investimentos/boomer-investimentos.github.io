#!/usr/bin/env node
/**
 * Gera o link do assessor para o Calendário Financeiro de um cliente.
 *
 * Uso:
 *   node --env-file=server/.env scripts/cal-mint-link.mjs <spreadsheetId>
 *
 * Precisa de CAL_JWT_SECRET e (opcional) CAL_APP_URL no ambiente.
 * O token embute só o spreadsheetId e não expira — quem tem o link vê o
 * calendário (mesma postura do Web App do Apps Script). Escrita exige e-mail.
 */

import auth from '../lib/cal/auth.js';

const sid = process.argv[2];
if (!sid) {
  console.error('uso: node --env-file=server/.env scripts/cal-mint-link.mjs <spreadsheetId>');
  process.exit(1);
}
if (!process.env.CAL_JWT_SECRET) {
  console.error('CAL_JWT_SECRET ausente — rode com --env-file=server/.env ou exporte a variável');
  process.exit(1);
}

const base = (process.env.CAL_APP_URL || 'https://www.boomerinvestimentos.com.br').replace(/\/+$/, '');
const token = auth.assinarLink(sid);

console.log(`${base}/calendario?s=${token}`);
