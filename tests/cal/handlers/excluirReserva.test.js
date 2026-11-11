'use strict';

process.env.CAL_JWT_SECRET = 'segredo-de-teste-bem-comprido-1234';

jest.mock('../../../lib/cal/sheets');

const sheets = require('../../../lib/cal/sheets');
const auth = require('../../../lib/cal/auth');
const fx = require('../fixtures/planilha');
const { excluirReserva } = require('../../../lib/cal/handlers/excluirReserva');

const sessaoValida = { [auth.COOKIE_NOME]: auth.assinarSessao({ sid: fx.SPREADSHEET_ID, email: fx.EMAIL }) };
// linha 2 = Reserva de emergência (id r-aaaa1111, com linha correspondente em HISTORICO_RESERVAS)
const pedido = (extra = {}) => ({ cookies: sessaoValida, linhaPlanilha: 2, ...extra });

function mockPlanilha({ reservas = fx.SHEETS.RESERVAS, historico = fx.SHEETS.HISTORICO_RESERVAS } = {}) {
  sheets.getValues.mockImplementation(async (_sid, range) => (
    range.startsWith('HISTORICO_RESERVAS') ? historico : reservas
  ));
}

beforeEach(() => {
  jest.resetAllMocks();
  mockPlanilha();
  sheets.deleteRows.mockResolvedValue();
});

describe('excluirReserva', () => {
  test('sem sessão -> 401, sem tocar na planilha', async () => {
    const r = await excluirReserva(pedido({ cookies: {} }));
    expect(r.status).toBe(401);
    expect(sheets.deleteRows).not.toHaveBeenCalled();
  });

  test('linhaPlanilha inválida -> 400', async () => {
    expect((await excluirReserva(pedido({ linhaPlanilha: 1 }))).status).toBe(400);
  });

  test('linha inexistente -> 404', async () => {
    expect((await excluirReserva(pedido({ linhaPlanilha: 999 }))).status).toBe(404);
    expect(sheets.deleteRows).not.toHaveBeenCalled();
  });

  test('id enviado não bate com o ID atual da linha -> 409, sem excluir', async () => {
    const r = await excluirReserva(pedido({ id: 'r-outro999' }));
    expect(r.status).toBe(409);
    expect(sheets.deleteRows).not.toHaveBeenCalled();
  });

  test('reserva com histórico -> remove a linha física e o histórico correspondente (por ID)', async () => {
    const r = await excluirReserva(pedido({ id: 'r-aaaa1111' }));
    expect(r.status).toBe(200);
    expect(r.body.modo).toBe('excluido');
    expect(sheets.deleteRows).toHaveBeenCalledWith(fx.SPREADSHEET_ID, 'RESERVAS', [2]);
    expect(sheets.deleteRows).toHaveBeenCalledWith(fx.SPREADSHEET_ID, 'HISTORICO_RESERVAS', [2]);
  });

  test('reserva sem histórico correspondente -> não chama deleteRows no histórico', async () => {
    const r = await excluirReserva(pedido({ linhaPlanilha: 3, id: 'r-bbbb2222' })); // Viagem, sem linha em HISTORICO_RESERVAS
    expect(r.status).toBe(200);
    expect(sheets.deleteRows).toHaveBeenCalledWith(fx.SPREADSHEET_ID, 'RESERVAS', [3]);
    expect(sheets.deleteRows).not.toHaveBeenCalledWith(fx.SPREADSHEET_ID, 'HISTORICO_RESERVAS', expect.anything());
  });

  test('sem a aba HISTORICO_RESERVAS -> remove só a linha de RESERVAS, sem erro', async () => {
    sheets.getValues.mockImplementation(async (_sid, range) => {
      if (range.startsWith('HISTORICO_RESERVAS')) throw new Error('Unable to parse range: HISTORICO_RESERVAS!A1:Z2000');
      return fx.SHEETS.RESERVAS;
    });
    const r = await excluirReserva(pedido({ id: 'r-aaaa1111' }));
    expect(r.status).toBe(200);
    expect(sheets.deleteRows).toHaveBeenCalledWith(fx.SPREADSHEET_ID, 'RESERVAS', [2]);
    expect(sheets.deleteRows).not.toHaveBeenCalledWith(fx.SPREADSHEET_ID, 'HISTORICO_RESERVAS', expect.anything());
  });
});
