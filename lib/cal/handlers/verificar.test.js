'use strict';

process.env.CAL_JWT_SECRET = 'segredo-de-teste-bem-comprido-1234';

const auth = require('../auth');
const { verificarAcesso } = require('./verificar');

describe('verificarAcesso', () => {
  test('token magic válido -> 200 + cookie de sessão', async () => {
    const magic = auth.assinarMagic({ sid: 'sid1', email: 'e@e.com' });
    const r = await verificarAcesso({ magicToken: magic });
    expect(r.status).toBe(200);
    expect(r.setCookie).toContain('cal_session=');
    const token = r.setCookie.split('cal_session=')[1].split(';')[0];
    expect(auth.verificar(token, 'session')).toMatchObject({ sid: 'sid1', email: 'e@e.com' });
  });

  test('token de outro propósito (link) -> 401', async () => {
    const link = auth.assinarLink('sid1');
    const r = await verificarAcesso({ magicToken: link });
    expect(r.status).toBe(401);
    expect(r.setCookie).toBeUndefined();
  });

  test('token expirado -> 401', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-10T12:00:00Z'));
    const magic = auth.assinarMagic({ sid: 'sid1', email: 'e@e.com' });
    jest.setSystemTime(new Date('2026-09-10T12:20:00Z'));
    const r = await verificarAcesso({ magicToken: magic });
    expect(r.status).toBe(401);
    jest.useRealTimers();
  });
});
