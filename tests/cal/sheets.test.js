'use strict';

process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({ client_email: 'x@example.com', private_key: 'x' });

const mockSpreadsheetsGet = jest.fn();
const mockSpreadsheetsBatchUpdate = jest.fn();

jest.mock('googleapis', () => ({
  google: {
    auth: { GoogleAuth: jest.fn().mockImplementation(() => ({})) },
    sheets: jest.fn(() => ({
      spreadsheets: {
        get: mockSpreadsheetsGet,
        batchUpdate: mockSpreadsheetsBatchUpdate,
      },
    })),
  },
}));

const sheets = require('../../lib/cal/sheets');
const spreadsheetsGet = mockSpreadsheetsGet;
const spreadsheetsBatchUpdate = mockSpreadsheetsBatchUpdate;

const SID = 'sid-teste';

beforeEach(() => {
  jest.clearAllMocks();
  spreadsheetsGet.mockResolvedValue({
    data: {
      sheets: [
        { properties: { sheetId: 111, title: 'CUSTO_FIXO' } },
        { properties: { sheetId: 222, title: 'HISTORICO_CUSTOS' } },
      ],
    },
  });
  spreadsheetsBatchUpdate.mockResolvedValue({});
});

describe('sheets.deleteRow/deleteRows', () => {
  test('linha 5 -> startIndex 4, endIndex 5, no sheetId certo da aba', async () => {
    await sheets.deleteRow(SID, 'CUSTO_FIXO', 5);
    expect(spreadsheetsBatchUpdate).toHaveBeenCalledWith({
      spreadsheetId: SID,
      requestBody: {
        requests: [{ deleteDimension: { range: { sheetId: 111, dimension: 'ROWS', startIndex: 4, endIndex: 5 } } }],
      },
    });
  });

  test('nunca deleta o cabeçalho (linha 1)', async () => {
    await sheets.deleteRows(SID, 'CUSTO_FIXO', [1]);
    expect(spreadsheetsBatchUpdate).not.toHaveBeenCalled();
  });

  test('várias linhas -> ordena decrescente pra não deslocar índice dentro do mesmo lote', async () => {
    await sheets.deleteRows(SID, 'HISTORICO_CUSTOS', [3, 10, 6]);
    const { requests } = spreadsheetsBatchUpdate.mock.calls[0][0].requestBody;
    expect(requests.map((r) => r.deleteDimension.range.startIndex)).toEqual([9, 5, 2]);
    expect(requests.every((r) => r.deleteDimension.range.sheetId === 222)).toBe(true);
  });

  test('linhas duplicadas são deduplicadas', async () => {
    await sheets.deleteRows(SID, 'CUSTO_FIXO', [5, 5, 5]);
    const { requests } = spreadsheetsBatchUpdate.mock.calls[0][0].requestBody;
    expect(requests).toHaveLength(1);
  });

  test('lista vazia ou só cabeçalho -> não chama a API', async () => {
    await sheets.deleteRows(SID, 'CUSTO_FIXO', []);
    await sheets.deleteRows(SID, 'CUSTO_FIXO', [1, 0, -1]);
    expect(spreadsheetsGet).not.toHaveBeenCalled();
    expect(spreadsheetsBatchUpdate).not.toHaveBeenCalled();
  });

  test('aba inexistente -> lança erro sem chamar batchUpdate', async () => {
    await expect(sheets.deleteRow(SID, 'NAO_EXISTE', 3)).rejects.toThrow('aba não encontrada');
    expect(spreadsheetsBatchUpdate).not.toHaveBeenCalled();
  });
});
