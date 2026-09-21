'use strict';

process.env.CAL_JWT_SECRET = 'segredo-de-teste-bem-comprido-1234';

jest.mock('../sheets');

const sheets = require('../sheets');
const auth = require('../auth');
const escrita = require('../escrita');
const fx = require('../../../tests/cal/fixtures/planilha');
const { editarRenda } = require('./editarRenda');

const sessaoValida = { [auth.COOKIE_NOME]: auth.assinarSessao({ sid: fx.SPREADSHEET_ID, email: fx.EMAIL }) };
const base = {
  cookies: sessaoValida,
  linhaPlanilha: 2, // Salário
  fonte: 'Salário',
  valor: 850,
  frequencia: 'Semanal',
  diaRecebimento: 'Sexta-feira',
  mes: '2026-09',
  repetirTodoMes: true,
};

beforeEach(() => {
  sheets.getValues.mockResolvedValue(fx.SHEETS.RENDA);
  sheets.updateRow.mockResolvedValue();
});

describe('editarRenda', () => {
  test('sem sessão -> 401', async () => {
    const r = await editarRenda({ ...base, cookies: {} });
    expect(r.status).toBe(401);
    expect(sheets.updateRow).not.toHaveBeenCalled();
  });

  test('linhaPlanilha inválida -> 400', async () => {
    const r = await editarRenda({ ...base, linhaPlanilha: 1 });
    expect(r.status).toBe(400);
  });

  test('fonte vazia -> 400', async () => {
    const r = await editarRenda({ ...base, fonte: '  ' });
    expect(r.status).toBe(400);
  });

  test('frequência inválida -> 400', async () => {
    const r = await editarRenda({ ...base, frequencia: 'Anual' });
    expect(r.status).toBe(400);
  });

  test('status fora do enum -> 400', async () => {
    const r = await editarRenda({ ...base, status: 'Cancelado' });
    expect(r.status).toBe(400);
  });

  test('linha inexistente -> 404', async () => {
    const r = await editarRenda({ ...base, linhaPlanilha: 999 });
    expect(r.status).toBe(404);
    expect(sheets.updateRow).not.toHaveBeenCalled();
  });

  test('preserva colunas não editadas e ajusta as editadas', async () => {
    await editarRenda({ ...base, valor: 850 });
    const [sid, aba, linha, linhaEditada] = sheets.updateRow.mock.calls[0];
    expect(sid).toBe(fx.SPREADSHEET_ID);
    expect(aba).toBe('RENDA');
    expect(linha).toBe(2);
    const header = escrita.cabecalhoRenda(fx.SHEETS.RENDA);
    expect(linhaEditada[header.indexOf('valor')]).toBe(850);
    expect(linhaEditada[header.indexOf('observacoes')]).toBe(fx.SHEETS.RENDA[1][header.indexOf('observacoes')]);
  });

  test('não mexe em Data_Início (preserva a original)', async () => {
    await editarRenda(base);
    const header = escrita.cabecalhoRenda(fx.SHEETS.RENDA);
    const [, , , linhaEditada] = sheets.updateRow.mock.calls[0];
    expect(linhaEditada[header.indexOf('data_inicio')]).toBe(fx.SHEETS.RENDA[1][header.indexOf('data_inicio')]);
  });

  test('não recorrente: Data_Fim vira o fim do mês', async () => {
    await editarRenda({ ...base, repetirTodoMes: false });
    const header = escrita.cabecalhoRenda(fx.SHEETS.RENDA);
    const [, , , linhaEditada] = sheets.updateRow.mock.calls[0];
    expect(linhaEditada[header.indexOf('data_fim')]).toBe('30/09/2026');
  });

  test('muda pra mensal e valida o dia numérico', async () => {
    const r = await editarRenda({ ...base, frequencia: 'Mensal', diaRecebimento: 5 });
    expect(r.status).toBe(200);
    const header = escrita.cabecalhoRenda(fx.SHEETS.RENDA);
    const [, , , linhaEditada] = sheets.updateRow.mock.calls[0];
    expect(linhaEditada[header.indexOf('frequencia')]).toBe('Mensal');
    expect(linhaEditada[header.indexOf('dia_recebimento')]).toBe('5');
  });

  test('status: Inativo desativa; omitido preserva o original', async () => {
    await editarRenda({ ...base, status: 'Inativo' });
    const header = escrita.cabecalhoRenda(fx.SHEETS.RENDA);
    const [, , , linhaComStatus] = sheets.updateRow.mock.calls[0];
    expect(linhaComStatus[header.indexOf('status')]).toBe('Inativo');

    sheets.updateRow.mockClear();
    await editarRenda(base);
    const [, , , linhaSemStatus] = sheets.updateRow.mock.calls[0];
    expect(linhaSemStatus[header.indexOf('status')]).toBe(fx.SHEETS.RENDA[1][header.indexOf('status')]);
  });

  test('sucesso devolve 200', async () => {
    const r = await editarRenda(base);
    expect(r.status).toBe(200);
  });
});
