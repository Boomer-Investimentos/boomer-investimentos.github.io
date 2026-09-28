'use strict';

process.env.CAL_JWT_SECRET = 'segredo-de-teste-bem-comprido-1234';

jest.mock('../sheets');

const sheets = require('../sheets');
const auth = require('../auth');
const escrita = require('../escrita');
const fx = require('../../../tests/cal/fixtures/planilha');
const { editarCusto } = require('./editarCusto');

const sessaoValida = { [auth.COOKIE_NOME]: auth.assinarSessao({ sid: fx.SPREADSHEET_ID, email: fx.EMAIL }) };
const base = {
  cookies: sessaoValida,
  linhaPlanilha: 2, // Aluguel
  nome: 'Aluguel',
  valor: 950,
  categoria: 'Moradia',
  dia: 1,
  mes: '2026-09',
  repetirTodoMes: true,
};

beforeEach(() => {
  sheets.getValues.mockResolvedValue(fx.SHEETS.CUSTO_FIXO);
  sheets.updateRow.mockResolvedValue();
});

describe('editarCusto', () => {
  test('sem sessão -> 401', async () => {
    const r = await editarCusto({ ...base, cookies: {} });
    expect(r.status).toBe(401);
    expect(sheets.updateRow).not.toHaveBeenCalled();
  });

  test('linhaPlanilha inválida -> 400', async () => {
    const r = await editarCusto({ ...base, linhaPlanilha: 1 });
    expect(r.status).toBe(400);
  });

  test('nome vazio -> 400', async () => {
    const r = await editarCusto({ ...base, nome: '  ' });
    expect(r.status).toBe(400);
  });

  test('valor não positivo -> 400', async () => {
    const r = await editarCusto({ ...base, valor: 0 });
    expect(r.status).toBe(400);
  });

  test('dia fora do mês -> 400', async () => {
    const r = await editarCusto({ ...base, dia: 31 }); // setembro tem 30
    expect(r.status).toBe(400);
  });

  test('mês mal formado -> 400', async () => {
    const r = await editarCusto({ ...base, mes: '2026/09' });
    expect(r.status).toBe(400);
  });

  test('status fora do enum -> 400', async () => {
    const r = await editarCusto({ ...base, status: 'Cancelado' });
    expect(r.status).toBe(400);
  });

  test('linha inexistente -> 404', async () => {
    const r = await editarCusto({ ...base, linhaPlanilha: 999 });
    expect(r.status).toBe(404);
    expect(sheets.updateRow).not.toHaveBeenCalled();
  });

  test('preserva colunas não editadas (Observações) e ajusta as editadas', async () => {
    await editarCusto(base);
    const [sid, aba, linha, linhaEditada] = sheets.updateRow.mock.calls[0];
    expect(sid).toBe(fx.SPREADSHEET_ID);
    expect(aba).toBe('CUSTO_FIXO');
    expect(linha).toBe(2);
    const header = escrita.cabecalhoCusto(fx.SHEETS.CUSTO_FIXO);
    expect(linhaEditada[header.indexOf('valor')]).toBe(950);
    expect(linhaEditada[header.indexOf('observacoes')]).toBe(fx.SHEETS.CUSTO_FIXO[1][header.indexOf('observacoes')]);
    expect(linhaEditada[header.indexOf('status_pagamento')]).toBe(fx.SHEETS.CUSTO_FIXO[1][header.indexOf('status_pagamento')]);
  });

  test('não recorrente: Data_Fim vira o fim do mês', async () => {
    await editarCusto({ ...base, repetirTodoMes: false });
    const header = escrita.cabecalhoCusto(fx.SHEETS.CUSTO_FIXO);
    const [, , , linhaEditada] = sheets.updateRow.mock.calls[0];
    expect(linhaEditada[header.indexOf('data_fim')]).toBe('30/09/2026');
  });

  test('recorrente: Data_Fim fica vazia', async () => {
    await editarCusto({ ...base, repetirTodoMes: true });
    const header = escrita.cabecalhoCusto(fx.SHEETS.CUSTO_FIXO);
    const [, , , linhaEditada] = sheets.updateRow.mock.calls[0];
    expect(linhaEditada[header.indexOf('data_fim')]).toBe('');
  });

  test('não mexe em Data_Início (preserva a original)', async () => {
    await editarCusto(base);
    const header = escrita.cabecalhoCusto(fx.SHEETS.CUSTO_FIXO);
    const [, , , linhaEditada] = sheets.updateRow.mock.calls[0];
    expect(linhaEditada[header.indexOf('data_inicio')]).toBe(fx.SHEETS.CUSTO_FIXO[1][header.indexOf('data_inicio')]);
  });

  test('status: Inativo desativa; omitido preserva o original', async () => {
    await editarCusto({ ...base, status: 'Inativo' });
    const header = escrita.cabecalhoCusto(fx.SHEETS.CUSTO_FIXO);
    const [, , , linhaComStatus] = sheets.updateRow.mock.calls[0];
    expect(linhaComStatus[header.indexOf('status')]).toBe('Inativo');

    sheets.updateRow.mockClear();
    await editarCusto(base);
    const [, , , linhaSemStatus] = sheets.updateRow.mock.calls[0];
    expect(linhaSemStatus[header.indexOf('status')]).toBe(fx.SHEETS.CUSTO_FIXO[1][header.indexOf('status')]);
  });

  test('sucesso devolve 200', async () => {
    const r = await editarCusto(base);
    expect(r.status).toBe(200);
  });
});
