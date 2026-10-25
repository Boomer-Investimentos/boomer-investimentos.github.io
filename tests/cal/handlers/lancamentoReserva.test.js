'use strict';

process.env.CAL_JWT_SECRET = 'segredo-de-teste-bem-comprido-1234';

jest.mock('../../../lib/cal/sheets');

const sheets = require('../../../lib/cal/sheets');
const auth = require('../../../lib/cal/auth');
const escrita = require('../../../lib/cal/escrita');
const fx = require('../fixtures/planilha');
const { criarReserva } = require('../../../lib/cal/handlers/lancamentoReserva');

const sessaoValida = { [auth.COOKIE_NOME]: auth.assinarSessao({ sid: fx.SPREADSHEET_ID, email: fx.EMAIL }) };
const base = { cookies: sessaoValida, nome: 'Fundo de viagem', valor: 200, dia: 12, frequencia: 'Mensal', mes: '2026-09' };

beforeEach(() => {
  sheets.getValues.mockResolvedValue(fx.SHEETS.RESERVAS);
  sheets.appendRow.mockResolvedValue();
});

describe('criarReserva', () => {
  test('sem sessão -> 401', async () => {
    const r = await criarReserva({ ...base, cookies: {} });
    expect(r.status).toBe(401);
    expect(sheets.appendRow).not.toHaveBeenCalled();
  });

  test('nome vazio -> 400', async () => {
    expect((await criarReserva({ ...base, nome: '  ' })).status).toBe(400);
  });

  test('valor não positivo -> 400', async () => {
    expect((await criarReserva({ ...base, valor: 0 })).status).toBe(400);
  });

  test('dia fora do mês -> 400', async () => {
    expect((await criarReserva({ ...base, dia: 31 })).status).toBe(400); // setembro tem 30
  });

  test('frequência Semanal -> 400 (só Mensal/Única)', async () => {
    expect((await criarReserva({ ...base, frequencia: 'Semanal' })).status).toBe(400);
  });

  test('grava na aba RESERVAS com Status Ativo e ID com prefixo r-', async () => {
    const r = await criarReserva(base);
    expect(r.status).toBe(201);
    const header = escrita.cabecalhoReserva(fx.SHEETS.RESERVAS);
    const [sid, aba, linha] = sheets.appendRow.mock.calls[0];
    expect(sid).toBe(fx.SPREADSHEET_ID);
    expect(aba).toBe('RESERVAS');
    expect(linha[header.indexOf('reserva')]).toBe('Fundo de viagem');
    expect(linha[header.indexOf('dia')]).toBe('12');
    expect(linha[header.indexOf('status')]).toBe('Ativo');
    expect(linha[header.indexOf('id')]).toMatch(/^r-[0-9a-f]{8}$/);
  });

  test('recorrente: Data_Fim em aberto; não recorrente: fim do mês', async () => {
    const header = escrita.cabecalhoReserva(fx.SHEETS.RESERVAS);
    await criarReserva({ ...base, repetirTodoMes: true });
    expect(sheets.appendRow.mock.calls[0][2][header.indexOf('data_fim')]).toBe('');

    sheets.appendRow.mockClear();
    await criarReserva({ ...base, repetirTodoMes: false });
    expect(sheets.appendRow.mock.calls[0][2][header.indexOf('data_fim')]).toBe('30/09/2026');
  });
});
