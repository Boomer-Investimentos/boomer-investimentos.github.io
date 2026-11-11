

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

/** Escreve uma coluna inteira (de `linhaInicio` pra baixo) numa só chamada. */
async function updateColumn(spreadsheetId, aba, colLetra, linhaInicio, valores) {
  const fim = linhaInicio + valores.length - 1;
  await client().spreadsheets.values.update({
    spreadsheetId,
    range: `${aba}!${colLetra}${linhaInicio}:${colLetra}${fim}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: valores.map((v) => [v]) },
  });
}

async function sheetIdDaAba(spreadsheetId, aba) {
  const r = await client().spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties(sheetId,title)',
  });
  const encontrada = (r.data.sheets || []).find((s) => s.properties.title === aba);
  if (!encontrada) throw new Error(`aba não encontrada: ${aba}`);
  return encontrada.properties.sheetId;
}

/**
 * Remove linhas físicas (1-based, nunca o cabeçalho na linha 1) numa só
 * chamada de batchUpdate. Ordena decrescente antes de montar os requests:
 * a API aplica cada deleteDimension em sequência, então deletar de baixo
 * pra cima evita que a exclusão de uma linha desloque o índice da próxima
 * ainda não processada no mesmo lote.
 */
async function deleteRows(spreadsheetId, aba, linhasPlanilha) {
  const linhas = [...new Set((linhasPlanilha || []).map(Number))]
    .filter((l) => Number.isInteger(l) && l >= 2)
    .sort((a, b) => b - a);
  if (!linhas.length) return;
  const sheetId = await sheetIdDaAba(spreadsheetId, aba);
  const requests = linhas.map((linha) => ({
    deleteDimension: {
      range: { sheetId, dimension: 'ROWS', startIndex: linha - 1, endIndex: linha },
    },
  }));
  await client().spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
}

async function deleteRow(spreadsheetId, aba, linhaPlanilha) {
  return deleteRows(spreadsheetId, aba, [linhaPlanilha]);
}

module.exports = {
  getValues, getTabs, appendRow, updateCell, updateRow, updateColumn, sheetIdDaAba, deleteRows, deleteRow,
};
