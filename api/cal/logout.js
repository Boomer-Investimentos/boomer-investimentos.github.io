'use strict';

const { encerrarSessao } = require('../../lib/cal/handlers/logout');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const r = await encerrarSessao();
  if (r.setCookie) res.setHeader('Set-Cookie', r.setCookie);
  return res.status(r.status).json(r.body);
};
