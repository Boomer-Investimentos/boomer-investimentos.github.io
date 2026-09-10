'use strict';

/**
 * Seam de I/O com o Google Sheets. Reusa o service account do site
 * (GOOGLE_SERVICE_ACCOUNT_JSON) + escopo `spreadsheets`. As planilhas dos
 * clientes já ficam na pasta compartilhada com esse service account.
 *
 * Este módulo é mockado nos testes (jest.mock) — não tem teste próprio.
 */

const { google } = require('googleapis');

const ESCOPO = ['https://www.googleapis.com/auth/spreadsheets'];

let _client;

function client() {
  if (_client) return _client;
  const raw = String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').replace(/^['"]|['"]$/g, '');
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON ausente');
  const credentials = JSON.parse(raw);
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ESCOPO });
  _client = google.sheets({ version: 'v4', auth });
  return _client;
}

/** Valores de um range (datas como serial Excel). Sempre array de linhas. */
async function getValues(spreadsheetId, range) {
  const r = await client().spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'SERIAL_NUMBER',
  });
  return r.data.values || [];
}

/** Lê várias abas de uma vez -> { CONFIG: rows, PARAMS: rows, ... }. */
async function getTabs(spreadsheetId, tabs) {
  const r = await client().spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: tabs.map((t) => `${t}!A1:Z2000`),
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'SERIAL_NUMBER',
  });
  const out = {};
  (r.data.valueRanges || []).forEach((vr, i) => {
    out[tabs[i]] = vr.values || [];
  });
  return out;
}

/** Acrescenta uma linha ao fim de uma aba. */
async function appendRow(spreadsheetId, tab, row) {
  await client().spreadsheets.values.append({
    spreadsheetId,
    range: `${tab}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}

/** Escreve uma célula (ex.: "CUSTO_FIXO!K12"). */
async function updateCell(spreadsheetId, a1, value) {
  await client().spreadsheets.values.update({
    spreadsheetId,
    range: a1,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[value]] },
  });
}

module.exports = { getValues, getTabs, appendRow, updateCell };
