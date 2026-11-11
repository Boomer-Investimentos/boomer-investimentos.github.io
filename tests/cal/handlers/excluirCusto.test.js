'use strict';

process.env.CAL_JWT_SECRET = 'segredo-de-teste-bem-comprido-1234';

jest.mock('../../../lib/cal/sheets');

const sheets = require('../../../lib/cal/sheets');
const auth = require('../../../lib/cal/auth');
const escrita = require('../../../lib/cal/escrita');
const fx = require('../fixtures/planilha');
const { excluirCusto } = require('../../../lib/cal/handlers/excluirCusto');

const sessaoValida = { [auth.COOKIE_NOME]: auth.assinarSessao({ sid: fx.SPREADSHEET_ID, email: fx.EMAIL }) };
const pedido = (extra = {}) => ({ cookies: sessaoValida, linhaPlanilha: 2, ...extra }); // linha 2 = Aluguel

function mockPlanilha({ custo = fx.SHEETS.CUSTO_FIXO, historico = fx.SHEETS.HISTORICO_CUSTOS } = {}) {
  sheets.getValues.mockImplementation(async (_sid, range) => (
    range.startsWith('HISTORICO_CUSTOS') ? historico : custo
  ));
}

beforeEach(() => {
  jest.resetAllMocks();
  mockPlanilha();
  sheets.updateRow.mockResolvedValue();
  sheets.deleteRows.mockResolvedValue();
});

describe('excluirCusto', () => {
  test('sem sessão -> 401, sem tocar na planilha', async () => {
    const r = await excluirCusto(pedido({ cookies: {} }));
    expect(r.status).toBe(401);
    expect(sheets.deleteRows).not.toHaveBeenCalled();
  });

  test('linhaPlanilha inválida -> 400', async () => {
    expect((await excluirCusto(pedido({ linhaPlanilha: 1 }))).status).toBe(400);
  });

  test('linha inexistente -> 404', async () => {
    expect((await excluirCusto(pedido({ linhaPlanilha: 999 }))).status).toBe(404);
    expect(sheets.deleteRows).not.toHaveBeenCalled();
  });

  test('id enviado não bate com o ID atual da linha -> 409, sem excluir', async () => {
    const custo = [
      ['Custo', 'Valor', 'Dia_Vencimento', 'Status', 'ID'],
      ['Aluguel', 900, 1, 'Ativo', 'c-abc12345'],
    ];
    mockPlanilha({ custo });
    const r = await excluirCusto(pedido({ id: 'c-outro999' }));
    expect(r.status).toBe(409);
    expect(sheets.deleteRows).not.toHaveBeenCalled();
    expect(sheets.updateRow).not.toHaveBeenCalled();
  });

  test('custo normal (não parcelado) -> remove a linha física e o histórico correspondente', async () => {
    const r = await excluirCusto(pedido());
    expect(r.status).toBe(200);
    expect(r.body.modo).toBe('excluido');
    expect(sheets.deleteRows).toHaveBeenCalledWith(fx.SPREADSHEET_ID, 'CUSTO_FIXO', [2]);
    expect(sheets.deleteRows).toHaveBeenCalledWith(fx.SPREADSHEET_ID, 'HISTORICO_CUSTOS', [2]);
    expect(sheets.updateRow).not.toHaveBeenCalled();
  });

  test('parcelado ainda em andamento (Data_Fim no futuro) -> remove a linha física', async () => {
    // "Compra parcelada A" (linha 9): 4 parcelas a partir de set/2026 -> termina em dez/2026, no futuro.
    const r = await excluirCusto(pedido({ linhaPlanilha: 9 }));
    expect(r.status).toBe(200);
    expect(r.body.modo).toBe('excluido');
    expect(sheets.deleteRows).toHaveBeenCalledWith(fx.SPREADSHEET_ID, 'CUSTO_FIXO', [9]);
    expect(sheets.updateRow).not.toHaveBeenCalled();
  });

  test('parcelado já finalizado (Data_Fim no passado) -> só marca Inativo, sem excluir a linha', async () => {
    const custo = fx.clone().CUSTO_FIXO;
    const h = escrita.cabecalhoCusto(custo);
    custo[1][h.indexOf('total_parcelas')] = 3;
    custo[1][h.indexOf('data_fim')] = '10/01/2026'; // bem no passado
    mockPlanilha({ custo });
    const r = await excluirCusto(pedido());
    expect(r.status).toBe(200);
    expect(r.body.modo).toBe('inativado');
    expect(sheets.deleteRows).not.toHaveBeenCalled();
    expect(sheets.updateRow).toHaveBeenCalled();
    const linhaEditada = sheets.updateRow.mock.calls[0][3];
    expect(linhaEditada[h.indexOf('status')]).toBe('Inativo');
    expect(linhaEditada[h.indexOf('valor')]).toBe(custo[1][h.indexOf('valor')]);
  });

  test('sem a aba HISTORICO_CUSTOS -> remove só a linha de CUSTO_FIXO, sem erro', async () => {
    sheets.getValues.mockImplementation(async (_sid, range) => {
      if (range.startsWith('HISTORICO_CUSTOS')) throw new Error('Unable to parse range: HISTORICO_CUSTOS!A1:Z2000');
      return fx.SHEETS.CUSTO_FIXO;
    });
    const r = await excluirCusto(pedido());
    expect(r.status).toBe(200);
    expect(sheets.deleteRows).toHaveBeenCalledWith(fx.SPREADSHEET_ID, 'CUSTO_FIXO', [2]);
    expect(sheets.deleteRows).not.toHaveBeenCalledWith(fx.SPREADSHEET_ID, 'HISTORICO_CUSTOS', expect.anything());
  });

  test('custo sem histórico correspondente -> não chama deleteRows no histórico', async () => {
    const r = await excluirCusto(pedido({ linhaPlanilha: 3 })); // Assinatura A, sem linha em HISTORICO_CUSTOS
    expect(r.status).toBe(200);
    expect(sheets.deleteRows).toHaveBeenCalledWith(fx.SPREADSHEET_ID, 'CUSTO_FIXO', [3]);
    expect(sheets.deleteRows).not.toHaveBeenCalledWith(fx.SPREADSHEET_ID, 'HISTORICO_CUSTOS', expect.anything());
  });
});
