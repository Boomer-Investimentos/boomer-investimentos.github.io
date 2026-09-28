'use strict';

/**
 * JWT (HS256) minimalista com `crypto` nativo + helpers de cookie.
 * Três propósitos de token:
 *   - "link"    : embutido no link do assessor (resolve o spreadsheetId). Sem exp.
 *   - "magic"   : no e-mail de verificação. Curto (15 min).
 *   - "session" : no cookie httpOnly após verificar o e-mail. 30 dias.
 * `purpose` no payload impede trocar um token pelo outro.
 */

const crypto = require('crypto');

const COOKIE_NOME = 'cal_session';
const MAGIC_TTL = 15 * 60; // 15 min
const SESSION_TTL = 30 * 24 * 60 * 60; // 30 dias

function segredo() {
  const s = process.env.CAL_JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error('CAL_JWT_SECRET ausente ou muito curto (defina uma env com >= 16 chars)');
  }
  return s;
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlJson(obj) {
  return b64url(JSON.stringify(obj));
}

function fromB64url(str) {
  return Buffer.from(String(str).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function assinarBruto(head, body) {
  return crypto.createHmac('sha256', segredo()).update(`${head}.${body}`).digest();
}

/** Assina um JWT. `opts.ttl` em segundos (omitido = sem expiração). */
function assinar(payload, opts = {}) {
  const head = b64urlJson({ alg: 'HS256', typ: 'JWT' });
  const agora = Math.floor(Date.now() / 1000);
  const corpo = { ...payload, iat: agora };
  if (opts.ttl) corpo.exp = agora + opts.ttl;
  const body = b64urlJson(corpo);
  return `${head}.${body}.${b64url(assinarBruto(head, body))}`;
}

/** Verifica assinatura, expiração e (se informado) o `purpose`. Lança em erro. */
function verificar(token, purposeEsperado) {
  const partes = String(token || '').split('.');
  if (partes.length !== 3) throw new Error('token malformado');
  const [head, body, sig] = partes;
  const esperada = assinarBruto(head, body);
  const recebida = fromB64url(sig);
  if (esperada.length !== recebida.length || !crypto.timingSafeEqual(esperada, recebida)) {
    throw new Error('assinatura inválida');
  }
  let payload;
  try {
    payload = JSON.parse(fromB64url(body).toString('utf8'));
  } catch {
    throw new Error('payload inválido');
  }
  if (payload.exp && Math.floor(Date.now() / 1000) >= payload.exp) {
    throw new Error('token expirado');
  }
  if (purposeEsperado && payload.purpose !== purposeEsperado) {
    throw new Error(`purpose inesperado: ${payload.purpose}`);
  }
  return payload;
}

const assinarLink = (sid) => assinar({ sid, purpose: 'link' });
const assinarMagic = ({ sid, email }) => assinar({ sid, email, purpose: 'magic' }, { ttl: MAGIC_TTL });
const assinarSessao = ({ sid, email }) => assinar({ sid, email, purpose: 'session' }, { ttl: SESSION_TTL });

/** String de Set-Cookie. `maxAge` em segundos; 0 apaga o cookie. */
function serializeCookie(nome, valor, { maxAge = SESSION_TTL } = {}) {
  const partes = [
    `${nome}=${valor}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  return partes.join('; ');
}

function cookieSessao(token) {
  return serializeCookie(COOKIE_NOME, token, { maxAge: SESSION_TTL });
}

function cookieLogout() {
  return serializeCookie(COOKIE_NOME, '', { maxAge: 0 });
}

/** Header "Cookie:" -> objeto { nome: valor }. */
function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const par of String(header).split(';')) {
    const i = par.indexOf('=');
    if (i < 0) continue;
    out[par.slice(0, i).trim()] = decodeURIComponent(par.slice(i + 1).trim());
  }
  return out;
}

/** Lê e valida a sessão a partir de cookies já parseados. null se inválida. */
function lerSessao(cookies) {
  const token = cookies && cookies[COOKIE_NOME];
  if (!token) return null;
  try {
    return verificar(token, 'session');
  } catch {
    return null;
  }
}

module.exports = {
  COOKIE_NOME,
  MAGIC_TTL,
  SESSION_TTL,
  assinar,
  verificar,
  assinarLink,
  assinarMagic,
  assinarSessao,
  serializeCookie,
  cookieSessao,
  cookieLogout,
  parseCookies,
  lerSessao,
};
