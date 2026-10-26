'use strict';

process.env.CAL_JWT_SECRET = 'segredo-de-teste-bem-comprido-1234';

jest.mock('../../../lib/cal/sheets');

const sheets = require('../../../lib/cal/sheets');
const auth = require('../../../lib/cal/auth');
const escrita = require('../../../lib/cal/escrita');
const fx = require('../fixtures/planilha');
const { editarReserva } = require('../../../lib/cal/handlers/editarReserva');

const sessaoValida = { [auth.COOKIE_NOME]: auth.assinarSessao({ sid: fx.SPREADSHEET_ID, email: fx.EMAIL }) };
const base = { cookies: sessaoValida, linhaPlanilha: 2, nome: 'Reserva de emergência', valor: 350, dia: 10, frequencia: 'Mensal', mes: '2026-09' };

beforeEach(() => {
  sheets.getValues.mockResolvedValue(fx.SHEETS.RESERVAS);
  sheets.updateRow.mockResolvedValue();
});

describe('editarReserva', () => {
  test('sem sessão -> 401', async () => {
    const r = await editarReserva({ ...base, cookies: {} });
    expect(r.status).toBe(401);
    expect(sheets.updateRow).not.toHaveBeenCalled();
  });

  test('linhaPlanilha inválida -> 400', async () => {
    expect((await editarReserva({ ...base, linhaPlanilha: 1 })).status).toBe(400);
  });

  test('status fora do enum -> 400', async () => {
    expect((await editarReserva({ ...base, status: 'Qualquer' })).status).toBe(400);
  });

  test('edita valor e preserva o ID da linha (merge)', async () => {
    const r = await editarReserva({ ...base, valor: 350 });
    expect(r.status).toBe(200);
    const header = escrita.cabecalhoReserva(fx.SHEETS.RESERVAS);
    const [, aba, linha, valores] = sheets.updateRow.mock.calls[0];
    expect(aba).toBe('RESERVAS');
    expect(linha).toBe(2);
    expect(valores[header.indexOf('valor')]).toBe(350);
    expect(valores[header.indexOf('id')]).toBe('r-aaaa1111');
  });

  test('status Inativo desativa (excluir)', async () => {
    await editarReserva({ ...base, status: 'Inativo' });
    const header = escrita.cabecalhoReserva(fx.SHEETS.RESERVAS);
    const [, , , valores] = sheets.updateRow.mock.calls[0];
    expect(valores[header.indexOf('status')]).toBe('Inativo');
  });
});
