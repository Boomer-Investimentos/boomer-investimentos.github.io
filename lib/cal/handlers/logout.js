'use strict';

const auth = require('../auth');

async function encerrarSessao() {
  return { status: 200, body: { ok: true }, setCookie: auth.cookieLogout() };
}

module.exports = { encerrarSessao };
