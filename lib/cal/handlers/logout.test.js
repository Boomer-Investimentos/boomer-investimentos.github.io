'use strict';

const { encerrarSessao } = require('./logout');

test('encerrarSessao devolve cookie com Max-Age=0', async () => {
  const r = await encerrarSessao();
  expect(r.status).toBe(200);
  expect(r.setCookie).toContain('Max-Age=0');
});
