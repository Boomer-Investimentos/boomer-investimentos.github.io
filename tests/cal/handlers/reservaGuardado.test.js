'use strict';

process.env.CAL_JWT_SECRET = 'segredo-de-teste-bem-comprido-1234';

jest.mock('../../../lib/cal/sheets');

const sheets = require('../../../lib/cal/sheets');
const auth = require('../../../lib/cal/auth');
const fx = require('../fixtures/planilha');
const { atualizarReserva } = require('../../../lib/cal/handlers/reservaGuardado');

const sessaoValida = { [auth.COOKIE_NOME]: auth.assinarSessao({ sid: fx.SPREADSHEET_ID, email: fx.EMAIL }) };
const HEADER_HIST = fx.SHEETS.HISTORICO_RESERVAS[0];
const pedido = (extra = {}) => ({ cookies: sessaoValida, linhaPlanilha: 2, statusReserva: 'Guardado', mes: '2026-10', ...extra });

function mockPlanilha({ historico = [HEADER_HIST], reservas = fx.SHEETS.RESERVAS } = {}) {
  sheets.getValues.mockImplementation(async (_sid, range) => (
    range.startsWith('HISTORICO_RESERVAS') ? historico : reservas
  ));
}

beforeEach(() => {
  jest.resetAllMocks();
  mockPlanilha();
  sheets.updateCell.mockResolvedValue();
  sheets.appendRow.mockResolvedValue();
});

describe('atualizarReserva', () => {
  test('sem sessão -> 401, sem tocar na planilha', async () => {
    const r = await atualizarReserva(pedido({ cookies: {} }));
    expect(r.status).toBe(401);
    expect(sheets.updateCell).not.toHaveBeenCalled();
  });

  test('statusReserva fora do enum -> 400', async () => {
    expect((await atualizarReserva(pedido({ statusReserva: 'Sei lá' }))).status).toBe(400);
  });

  test('mes fora do formato -> 400', async () => {
    expect((await atualizarReserva(pedido({ mes: '2026/10' }))).status).toBe(400);
  });

  test('linha sem reserva -> 404', async () => {
    expect((await atualizarReserva(pedido({ linhaPlanilha: 500 }))).status).toBe(404);
  });

  test('planilha sem a aba HISTORICO_RESERVAS -> 422, sem escrever', async () => {
    sheets.getValues.mockImplementation(async (_sid, range) => {
      if (range.startsWith('HISTORICO_RESERVAS')) throw new Error('Unable to parse range: HISTORICO_RESERVAS!A1:Z2000');
      return fx.SHEETS.RESERVAS;
    });
    const r = await atualizarReserva(pedido());
    expect(r.status).toBe(422);
    expect(sheets.updateCell).not.toHaveBeenCalled();
    expect(sheets.appendRow).not.toHaveBeenCalled();
  });

  test('Guardado sem registro no mês -> cria linha no histórico', async () => {
    const r = await atualizarReserva(pedido({ statusReserva: 'Guardado', mes: '2026-10' }));
    expect(r.status).toBe(200);
    expect(sheets.appendRow).toHaveBeenCalled();
    expect(sheets.appendRow.mock.calls[0][1]).toBe('HISTORICO_RESERVAS');
  });

  test('Pendente sem registro -> não escreve nada', async () => {
    const r = await atualizarReserva(pedido({ statusReserva: 'Pendente', mes: '2026-10' }));
    expect(r.status).toBe(200);
    expect(sheets.appendRow).not.toHaveBeenCalled();
  });

  test('Guardado com registro do ano existente -> atualiza a célula do mês', async () => {
    mockPlanilha({ historico: fx.SHEETS.HISTORICO_RESERVAS });
    const r = await atualizarReserva(pedido({ statusReserva: 'Guardado', mes: '2026-10' }));
    expect(r.status).toBe(200);
    expect(sheets.updateCell).toHaveBeenCalled();
    expect(sheets.appendRow).not.toHaveBeenCalled();
  });
});
