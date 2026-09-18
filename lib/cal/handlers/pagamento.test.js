'use strict';

process.env.CAL_JWT_SECRET = 'segredo-de-teste-bem-comprido-1234';

jest.mock('../sheets');

const sheets = require('../sheets');
const auth = require('../auth');
const escrita = require('../escrita');
const fx = require('../../../tests/cal/fixtures/planilha');
const { atualizarPagamento } = require('./pagamento');

const sessaoValida = { [auth.COOKIE_NOME]: auth.assinarSessao({ sid: fx.SPREADSHEET_ID, email: fx.EMAIL }) };

beforeEach(() => {
  sheets.getValues.mockResolvedValue(fx.SHEETS.CUSTO_FIXO);
  sheets.updateCell.mockResolvedValue();
});

describe('atualizarPagamento', () => {
  test('sem sessão -> 401, sem tocar na planilha', async () => {
    const r = await atualizarPagamento({ cookies: {}, linhaPlanilha: 2, statusPagamento: 'Pago' });
    expect(r.status).toBe(401);
    expect(sheets.updateCell).not.toHaveBeenCalled();
  });

  test('linhaPlanilha inválida -> 400', async () => {
    const r = await atualizarPagamento({ cookies: sessaoValida, linhaPlanilha: 1, statusPagamento: 'Pago' });
    expect(r.status).toBe(400);
  });

  test('statusPagamento fora do enum -> 400', async () => {
    const r = await atualizarPagamento({ cookies: sessaoValida, linhaPlanilha: 2, statusPagamento: 'Atrasado' });
    expect(r.status).toBe(400);
  });

  test('planilha sem coluna Status_Pagamento -> 500, sem escrever', async () => {
    sheets.getValues.mockResolvedValue([['Custo', 'Valor'], ['Aluguel', 900]]);
    const r = await atualizarPagamento({ cookies: sessaoValida, linhaPlanilha: 2, statusPagamento: 'Pago' });
    expect(r.status).toBe(500);
    expect(sheets.updateCell).not.toHaveBeenCalled();
  });

  test('marca como Pago na célula correta (linha do Aluguel = 2)', async () => {
    const header = escrita.cabecalhoCusto(fx.SHEETS.CUSTO_FIXO);
    const idx = header.indexOf('status_pagamento');
    const r = await atualizarPagamento({ cookies: sessaoValida, linhaPlanilha: 2, statusPagamento: 'Pago' });
    expect(r.status).toBe(200);
    expect(sheets.updateCell).toHaveBeenCalledWith(
      fx.SPREADSHEET_ID,
      `CUSTO_FIXO!${escrita.colunaLetra(idx)}2`,
      'Pago'
    );
  });
});
