'use strict';

process.env.CAL_JWT_SECRET = 'segredo-de-teste-bem-comprido-1234';
process.env.CAL_APP_URL = 'https://cal.exemplo.com';

jest.mock('../sheets');
jest.mock('../email');

const sheets = require('../sheets');
const emailIO = require('../email');
const auth = require('../auth');
const fx = require('../../../tests/cal/fixtures/planilha');
const { pedirAcesso } = require('./login');

beforeEach(() => {
  sheets.getValues.mockResolvedValue(fx.SHEETS.CONFIG);
  emailIO.enviarMagicLink.mockResolvedValue();
});

describe('pedirAcesso', () => {
  test('e-mail mal formado -> 400, sem tocar em planilha/e-mail', async () => {
    const link = auth.assinarLink(fx.SPREADSHEET_ID);
    const r = await pedirAcesso({ linkToken: link, email: 'não-é-email' });
    expect(r.status).toBe(400);
    expect(sheets.getValues).not.toHaveBeenCalled();
  });

  test('link inválido -> 401', async () => {
    const r = await pedirAcesso({ linkToken: 'lixo', email: fx.EMAIL });
    expect(r.status).toBe(401);
  });

  test('e-mail não cadastrado -> 200 genérico, mas não envia e-mail', async () => {
    const link = auth.assinarLink(fx.SPREADSHEET_ID);
    const r = await pedirAcesso({ linkToken: link, email: 'outro@dominio.com' });
    expect(r.status).toBe(200);
    expect(emailIO.enviarMagicLink).not.toHaveBeenCalled();
  });

  test('e-mail cadastrado (tolerando caixa) -> envia magic link com URL correta', async () => {
    const link = auth.assinarLink(fx.SPREADSHEET_ID);
    const r = await pedirAcesso({ linkToken: link, email: fx.EMAIL.toUpperCase() });
    expect(r.status).toBe(200);
    expect(emailIO.enviarMagicLink).toHaveBeenCalledTimes(1);
    const args = emailIO.enviarMagicLink.mock.calls[0][0];
    expect(args.to).toBe(fx.EMAIL);
    expect(args.cliente).toBe('Cliente Exemplo');
    expect(args.url).toMatch(/^https:\/\/cal\.exemplo\.com\/calendario\?t=/);

    const token = args.url.split('t=')[1];
    expect(auth.verificar(token, 'magic')).toMatchObject({ sid: fx.SPREADSHEET_ID, email: fx.EMAIL });
  });
});
