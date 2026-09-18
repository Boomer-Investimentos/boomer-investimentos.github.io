'use strict';

process.env.CAL_JWT_SECRET = 'segredo-de-teste-bem-comprido-1234';

jest.mock('../sheets');

const sheets = require('../sheets');
const auth = require('../auth');
const fx = require('../../../tests/cal/fixtures/planilha');
const { obterMes } = require('./mes');

beforeEach(() => {
  sheets.getTabs.mockResolvedValue({
    CONFIG: fx.SHEETS.CONFIG,
    PARAMS: fx.SHEETS.PARAMS,
    RENDA: fx.SHEETS.RENDA,
    CUSTO_FIXO: fx.SHEETS.CUSTO_FIXO,
  });
});

describe('obterMes', () => {
  test('mes fora do formato YYYY-MM -> 400', async () => {
    const r = await obterMes({ cookies: {}, linkToken: null, mes: '09-2026' });
    expect(r.status).toBe(400);
  });

  test('sem cookie de sessão e sem link -> 401', async () => {
    const r = await obterMes({ cookies: {}, linkToken: null, mes: '2026-09' });
    expect(r.status).toBe(401);
    expect(sheets.getTabs).not.toHaveBeenCalled();
  });

  test('link token inválido -> 401', async () => {
    const r = await obterMes({ cookies: {}, linkToken: 'lixo', mes: '2026-09' });
    expect(r.status).toBe(401);
  });

  test('link válido dá acesso de leitura (autenticado:false)', async () => {
    const link = auth.assinarLink(fx.SPREADSHEET_ID);
    const r = await obterMes({ cookies: {}, linkToken: link, mes: '2026-09' });
    expect(r.status).toBe(200);
    expect(r.body.autenticado).toBe(false);
    expect(r.body.cliente).toBe('Cliente Exemplo');
    expect(r.body.dias).toHaveLength(30);
    expect(sheets.getTabs).toHaveBeenCalledWith(fx.SPREADSHEET_ID, ['CONFIG', 'PARAMS', 'RENDA', 'CUSTO_FIXO']);
  });

  test('sessão válida dá acesso (autenticado:true), sem precisar de link', async () => {
    const token = auth.assinarSessao({ sid: fx.SPREADSHEET_ID, email: fx.EMAIL });
    const r = await obterMes({ cookies: { [auth.COOKIE_NOME]: token }, linkToken: null, mes: '2026-09' });
    expect(r.status).toBe(200);
    expect(r.body.autenticado).toBe(true);
  });

  test('sessão tem prioridade sobre link', async () => {
    const token = auth.assinarSessao({ sid: fx.SPREADSHEET_ID, email: fx.EMAIL });
    const r = await obterMes({ cookies: { [auth.COOKIE_NOME]: token }, linkToken: 'qualquer-coisa-invalida', mes: '2026-09' });
    expect(r.status).toBe(200);
    expect(r.body.autenticado).toBe(true);
  });
});
