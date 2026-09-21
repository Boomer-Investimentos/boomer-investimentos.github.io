

// Este módulo é mockado nos testes (jest.mock) — não tem teste próprio.

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


async function getValues(spreadsheetId, range) {
  const r = await client().spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'SERIAL_NUMBER',
  });
  return r.data.values || [];
}

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


async function appendRow(spreadsheetId, tab, row) {
  await client().spreadsheets.values.append({
    spreadsheetId,
    range: `${tab}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}


async function updateCell(spreadsheetId, a1, value) {
  await client().spreadsheets.values.update({
    spreadsheetId,
    range: a1,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[value]] },
  });
}

async function updateRow(spreadsheetId, aba, linhaPlanilha, valores) {
  await client().spreadsheets.values.update({
    spreadsheetId,
    range: `${aba}!A${linhaPlanilha}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [valores] },
  });
}

module.exports = { getValues, getTabs, appendRow, updateCell, updateRow };
