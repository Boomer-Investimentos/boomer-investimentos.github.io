'use strict';

process.env.CAL_JWT_SECRET = 'segredo-de-teste-bem-comprido-1234';

const a = require('./auth');

describe('assinar / verificar', () => {
  test('round-trip preserva payload e purpose', () => {
    const t = a.assinar({ sid: 'abc', email: 'x@y.com' }, { ttl: 60 });
    const p = a.verificar(t, undefined);
    expect(p).toMatchObject({ sid: 'abc', email: 'x@y.com' });
    expect(p.purpose).toBeUndefined();
    expect(p.iat).toEqual(expect.any(Number));
    expect(p.exp).toEqual(expect.any(Number));
  });

  test('assinatura adulterada é rejeitada', () => {
    const t = a.assinarLink('abc');
    const quebrado = `${t.slice(0, -3)}xyz`;
    expect(() => a.verificar(quebrado)).toThrow();
  });

  test('token de outro segredo é rejeitado', () => {
    const t = a.assinarLink('abc');
    process.env.CAL_JWT_SECRET = 'outro-segredo-bem-comprido-9999';
    expect(() => a.verificar(t)).toThrow(/assinatura/);
    process.env.CAL_JWT_SECRET = 'segredo-de-teste-bem-comprido-1234';
  });

  test('malformado é rejeitado', () => {
    expect(() => a.verificar('nada')).toThrow(/malformado/);
    expect(() => a.verificar('')).toThrow();
  });
});

describe('purpose', () => {
  test('link/magic/session não se confundem', () => {
    const link = a.assinarLink('s1');
    const magic = a.assinarMagic({ sid: 's1', email: 'e@e.com' });
    const sess = a.assinarSessao({ sid: 's1', email: 'e@e.com' });

    expect(a.verificar(link, 'link').sid).toBe('s1');
    expect(() => a.verificar(link, 'session')).toThrow(/purpose/);
    expect(() => a.verificar(sess, 'magic')).toThrow(/purpose/);
    expect(a.verificar(magic, 'magic').email).toBe('e@e.com');
  });
});

describe('expiração', () => {
  afterEach(() => jest.useRealTimers());

  test('magic expira em 15 min', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-10T12:00:00Z'));
    const magic = a.assinarMagic({ sid: 's', email: 'e@e.com' });
    jest.setSystemTime(new Date('2026-09-10T12:14:00Z'));
    expect(a.verificar(magic, 'magic').sid).toBe('s');
    jest.setSystemTime(new Date('2026-09-10T12:16:00Z'));
    expect(() => a.verificar(magic, 'magic')).toThrow(/expirado/);
  });

  test('link não expira', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-10T12:00:00Z'));
    const link = a.assinarLink('s');
    jest.setSystemTime(new Date('2030-01-01T00:00:00Z'));
    expect(a.verificar(link, 'link').sid).toBe('s');
  });
});

describe('cookies', () => {
  test('cookieSessao tem as flags de segurança', () => {
    const c = a.cookieSessao('TOKEN');
    expect(c).toMatch(/^cal_session=TOKEN/);
    expect(c).toContain('HttpOnly');
    expect(c).toContain('Secure');
    expect(c).toContain('SameSite=Lax');
    expect(c).toContain('Path=/');
    expect(c).toMatch(/Max-Age=\d+/);
  });

  test('cookieLogout zera o Max-Age', () => {
    expect(a.cookieLogout()).toContain('Max-Age=0');
  });

  test('parseCookies + lerSessao', () => {
    const token = a.assinarSessao({ sid: 's9', email: 'z@z.com' });
    const cookies = a.parseCookies(`outra=1; ${a.COOKIE_NOME}=${token}`);
    expect(cookies[a.COOKIE_NOME]).toBe(token);
    expect(a.lerSessao(cookies)).toMatchObject({ sid: 's9', email: 'z@z.com', purpose: 'session' });
  });

  test('lerSessao devolve null sem cookie ou com lixo', () => {
    expect(a.lerSessao({})).toBeNull();
    expect(a.lerSessao({ [a.COOKIE_NOME]: 'lixo' })).toBeNull();
  });
});
