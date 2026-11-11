'use strict';

process.env.CAL_JWT_SECRET = 'segredo-de-teste-bem-comprido-1234';

jest.mock('../../../lib/cal/sheets');

const sheets = require('../../../lib/cal/sheets');
const auth = require('../../../lib/cal/auth');
const fx = require('../fixtures/planilha');
const { excluirRenda } = require('../../../lib/cal/handlers/excluirRenda');

const sessaoValida = { [auth.COOKIE_NOME]: auth.assinarSessao({ sid: fx.SPREADSHEET_ID, email: fx.EMAIL }) };
const pedido = (extra = {}) => ({ cookies: sessaoValida, linhaPlanilha: 2, ...extra }); // linha 2 = Salário

beforeEach(() => {
  jest.resetAllMocks();
  sheets.getValues.mockResolvedValue(fx.SHEETS.RENDA);
  sheets.deleteRows.mockResolvedValue();
});

describe('excluirRenda', () => {
  test('sem sessão -> 401, sem tocar na planilha', async () => {
    const r = await excluirRenda(pedido({ cookies: {} }));
    expect(r.status).toBe(401);
    expect(sheets.deleteRows).not.toHaveBeenCalled();
  });

  test('linhaPlanilha inválida -> 400', async () => {
    expect((await excluirRenda(pedido({ linhaPlanilha: 1 }))).status).toBe(400);
  });

  test('linha inexistente -> 404', async () => {
    expect((await excluirRenda(pedido({ linhaPlanilha: 999 }))).status).toBe(404);
    expect(sheets.deleteRows).not.toHaveBeenCalled();
  });

  test('id enviado não bate com o ID atual da linha -> 409, sem excluir', async () => {
    const renda = [
      ['Fonte_Renda', 'Valor', 'Status', 'ID'],
      ['Salário', 800, 'Ativo', 'rn-abc12345'],
    ];
    sheets.getValues.mockResolvedValue(renda);
    const r = await excluirRenda(pedido({ id: 'rn-outro999' }));
    expect(r.status).toBe(409);
    expect(sheets.deleteRows).not.toHaveBeenCalled();
  });

  test('sucesso -> remove a linha física da planilha', async () => {
    const r = await excluirRenda(pedido());
    expect(r.status).toBe(200);
    expect(r.body.modo).toBe('excluido');
    expect(sheets.deleteRows).toHaveBeenCalledWith(fx.SPREADSHEET_ID, 'RENDA', [2]);
  });
});
