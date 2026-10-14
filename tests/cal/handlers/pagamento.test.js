'use strict';

process.env.CAL_JWT_SECRET = 'segredo-de-teste-bem-comprido-1234';

jest.mock('../../../lib/cal/sheets');

const sheets = require('../../../lib/cal/sheets');
const auth = require('../../../lib/cal/auth');
const escrita = require('../../../lib/cal/escrita');
const schema = require('../../../lib/cal/schema');
const { hojeISO } = require('../../../lib/cal/dates');
const fx = require('../fixtures/planilha');
const { atualizarPagamento } = require('../../../lib/cal/handlers/pagamento');

const sessaoValida = { [auth.COOKIE_NOME]: auth.assinarSessao({ sid: fx.SPREADSHEET_ID, email: fx.EMAIL }) };
const MES_ATUAL = hojeISO().slice(0, 7);
const HEADER_HIST = fx.SHEETS.HISTORICO_CUSTOS[0];
const pedido = (extra = {}) => ({ cookies: sessaoValida, linhaPlanilha: 2, statusPagamento: 'Pago', mes: '2026-09', ...extra });

function mockPlanilha({ historico = [HEADER_HIST], custo = fx.SHEETS.CUSTO_FIXO } = {}) {
  sheets.getValues.mockImplementation(async (_sid, range) => (
    range.startsWith('HISTORICO_CUSTOS') ? historico : custo
  ));
}

beforeEach(() => {
  jest.resetAllMocks();
  mockPlanilha();
  sheets.updateCell.mockResolvedValue();
  sheets.appendRow.mockResolvedValue();
});

describe('atualizarPagamento', () => {
  test('sem sessão -> 401, sem tocar na planilha', async () => {
    const r = await atualizarPagamento(pedido({ cookies: {} }));
    expect(r.status).toBe(401);
    expect(sheets.updateCell).not.toHaveBeenCalled();
  });

  test('linhaPlanilha inválida -> 400', async () => {
    expect((await atualizarPagamento(pedido({ linhaPlanilha: 1 }))).status).toBe(400);
  });

  test('statusPagamento fora do enum -> 400', async () => {
    expect((await atualizarPagamento(pedido({ statusPagamento: 'Atrasado' }))).status).toBe(400);
  });

  test('mes ausente ou fora do formato -> 400, sem escrever', async () => {
    expect((await atualizarPagamento(pedido({ mes: undefined }))).status).toBe(400);
    expect((await atualizarPagamento(pedido({ mes: '09-2026' }))).status).toBe(400);
    expect(sheets.updateCell).not.toHaveBeenCalled();
    expect(sheets.appendRow).not.toHaveBeenCalled();
  });

  test('planilha sem coluna Status_Pagamento -> 500, sem escrever', async () => {
    mockPlanilha({ custo: [['Custo', 'Valor'], ['Aluguel', 900]] });
    const r = await atualizarPagamento(pedido());
    expect(r.status).toBe(500);
    expect(sheets.updateCell).not.toHaveBeenCalled();
  });

  test('linha sem custo -> 404', async () => {
    expect((await atualizarPagamento(pedido({ linhaPlanilha: 500 }))).status).toBe(404);
  });

  test('planilha sem a aba HISTORICO_CUSTOS -> 422, sem escrever', async () => {
    sheets.getValues.mockImplementation(async (_sid, range) => {
      if (range.startsWith('HISTORICO_CUSTOS')) throw new Error('Unable to parse range: HISTORICO_CUSTOS!A1:Z2000');
      return fx.SHEETS.CUSTO_FIXO;
    });
    const r = await atualizarPagamento(pedido());
    expect(r.status).toBe(422);
    expect(sheets.updateCell).not.toHaveBeenCalled();
    expect(sheets.appendRow).not.toHaveBeenCalled();
  });

  test('Pago sem linha no histórico -> cria linha custo+ano com o valor no mês', async () => {
    const r = await atualizarPagamento(pedido({ mes: '2026-09' }));
    expect(r.status).toBe(200);
    expect(sheets.appendRow).toHaveBeenCalledTimes(1);
    const [sid, aba, linha] = sheets.appendRow.mock.calls[0];
    expect(sid).toBe(fx.SPREADSHEET_ID);
    expect(aba).toBe('HISTORICO_CUSTOS');
    const h = schema.parseHistorico([HEADER_HIST, linha]);
    expect(h['aluguel|2026'].meses).toEqual({ 9: 900 });
  });

  test('Pago com linha existente -> escreve o valor só na coluna do mês', async () => {
    mockPlanilha({ historico: fx.SHEETS.HISTORICO_CUSTOS });
    const r = await atualizarPagamento(pedido({ mes: '2026-10' }));
    expect(r.status).toBe(200);
    expect(sheets.appendRow).not.toHaveBeenCalled();
    const idxOut = schema.MESES_ROTULOS.indexOf('Out') + 2;
    expect(sheets.updateCell).toHaveBeenCalledWith(fx.SPREADSHEET_ID, `HISTORICO_CUSTOS!${escrita.colunaLetra(idxOut)}2`, 900);
  });

  test('Pendente apaga o valor do mês no histórico', async () => {
    mockPlanilha({ historico: fx.SHEETS.HISTORICO_CUSTOS });
    const r = await atualizarPagamento(pedido({ mes: '2026-09', statusPagamento: 'Pendente' }));
    expect(r.status).toBe(200);
    const idxSet = schema.MESES_ROTULOS.indexOf('Set') + 2;
    expect(sheets.updateCell).toHaveBeenCalledWith(fx.SPREADSHEET_ID, `HISTORICO_CUSTOS!${escrita.colunaLetra(idxSet)}2`, '');
  });

  test('Pendente sem linha no histórico não escreve nada no histórico', async () => {
    const r = await atualizarPagamento(pedido({ statusPagamento: 'Pendente', mes: '2026-09' }));
    expect(r.status).toBe(200);
    expect(sheets.appendRow).not.toHaveBeenCalled();
  });

  test('mês atual também espelha Status_Pagamento na CUSTO_FIXO', async () => {
    const header = escrita.cabecalhoCusto(fx.SHEETS.CUSTO_FIXO);
    const idx = header.indexOf('status_pagamento');
    const r = await atualizarPagamento(pedido({ mes: MES_ATUAL }));
    expect(r.status).toBe(200);
    expect(sheets.updateCell).toHaveBeenCalledWith(fx.SPREADSHEET_ID, `CUSTO_FIXO!${escrita.colunaLetra(idx)}2`, 'Pago');
  });

  test('outro mês não mexe em Status_Pagamento da CUSTO_FIXO', async () => {
    mockPlanilha({ historico: fx.SHEETS.HISTORICO_CUSTOS });
    const mesOutro = MES_ATUAL === '2026-01' ? '2026-02' : '2026-01';
    await atualizarPagamento(pedido({ mes: mesOutro }));
    const chamadas = sheets.updateCell.mock.calls.map((c) => c[1]);
    expect(chamadas.some((a1) => a1.startsWith('CUSTO_FIXO!'))).toBe(false);
  });
});
