'use strict';

process.env.CAL_JWT_SECRET = 'segredo-de-teste-bem-comprido-1234';

jest.mock('../sheets');

const sheets = require('../sheets');
const auth = require('../auth');
const escrita = require('../escrita');
const fx = require('../../../tests/cal/fixtures/planilha');
const { criarRenda } = require('./lancamentoRenda');

const sessaoValida = { [auth.COOKIE_NOME]: auth.assinarSessao({ sid: fx.SPREADSHEET_ID, email: fx.EMAIL }) };
const baseMensal = { cookies: sessaoValida, fonte: 'Freelance', valor: 300, frequencia: 'Mensal', diaRecebimento: 10, mes: '2026-09' };
const baseSemanal = { cookies: sessaoValida, fonte: 'Freelance', valor: 300, frequencia: 'Semanal', diaRecebimento: 'Sexta-feira', mes: '2026-09' };

beforeEach(() => {
  sheets.getValues.mockResolvedValue(fx.SHEETS.RENDA);
  sheets.appendRow.mockResolvedValue();
});

describe('criarRenda', () => {
  test('sem sessão -> 401', async () => {
    const r = await criarRenda({ ...baseMensal, cookies: {} });
    expect(r.status).toBe(401);
    expect(sheets.appendRow).not.toHaveBeenCalled();
  });

  test('fonte vazia -> 400', async () => {
    const r = await criarRenda({ ...baseMensal, fonte: '  ' });
    expect(r.status).toBe(400);
  });

  test('valor não positivo -> 400', async () => {
    const r = await criarRenda({ ...baseMensal, valor: 0 });
    expect(r.status).toBe(400);
  });

  test('mês mal formado -> 400', async () => {
    const r = await criarRenda({ ...baseMensal, mes: '2026/09' });
    expect(r.status).toBe(400);
  });

  test('frequência inválida -> 400', async () => {
    const r = await criarRenda({ ...baseMensal, frequencia: 'Anual' });
    expect(r.status).toBe(400);
  });

  test('mensal: dia fora do mês -> 400', async () => {
    const r = await criarRenda({ ...baseMensal, diaRecebimento: 31 }); // setembro tem 30
    expect(r.status).toBe(400);
  });

  test('semanal: nome de dia inválido -> 400', async () => {
    const r = await criarRenda({ ...baseSemanal, diaRecebimento: 'algumdia' });
    expect(r.status).toBe(400);
  });

  test('mensal: grava com sucesso e Frequência canônica', async () => {
    const r = await criarRenda(baseMensal);
    expect(r.status).toBe(201);
    const header = escrita.cabecalhoRenda(fx.SHEETS.RENDA);
    const [sid, aba, linha] = sheets.appendRow.mock.calls[0];
    expect(sid).toBe(fx.SPREADSHEET_ID);
    expect(aba).toBe('RENDA');
    expect(linha[header.indexOf('fonte_renda')]).toBe('Freelance');
    expect(linha[header.indexOf('frequencia')]).toBe('Mensal');
    expect(linha[header.indexOf('dia_recebimento')]).toBe('10');
    expect(linha[header.indexOf('status')]).toBe('Ativo');
  });

  test('semanal: aceita nome de dia tolerando acento/caixa', async () => {
    const r = await criarRenda({ ...baseSemanal, diaRecebimento: 'sexta' });
    expect(r.status).toBe(201);
  });

  test('frequência "unica" (sem acento, minúscula) é normalizada pra "Única"', async () => {
    await criarRenda({ ...baseMensal, frequencia: 'unica' });
    const header = escrita.cabecalhoRenda(fx.SHEETS.RENDA);
    const [, , linha] = sheets.appendRow.mock.calls[0];
    expect(linha[header.indexOf('frequencia')]).toBe('Única');
  });

  test('recorrente: Data_Fim em aberto; não recorrente: fim do mês', async () => {
    await criarRenda({ ...baseMensal, repetirTodoMes: true });
    const header = escrita.cabecalhoRenda(fx.SHEETS.RENDA);
    let [, , linha] = sheets.appendRow.mock.calls[0];
    expect(linha[header.indexOf('data_fim')]).toBe('');

    sheets.appendRow.mockClear();
    await criarRenda({ ...baseMensal, repetirTodoMes: false });
    [, , linha] = sheets.appendRow.mock.calls[0];
    expect(linha[header.indexOf('data_fim')]).toBe('30/09/2026');
    expect(linha[header.indexOf('data_inicio')]).toBe('01/09/2026');
  });
});
