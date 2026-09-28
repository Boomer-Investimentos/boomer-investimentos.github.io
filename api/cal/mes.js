'use strict';

const auth = require('../../lib/cal/auth');
const { obterMes } = require('../../lib/cal/handlers/mes');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const cookies = auth.parseCookies(req.headers.cookie);
  const { mes, s: linkToken } = req.query || {};

  try {
    const r = await obterMes({ cookies, linkToken, mes });
    return res.status(r.status).json(r.body);
  } catch (err) {
    console.error('cal/mes error:', err.message);
    return res.status(502).json({ error: 'Não foi possível carregar o calendário. Tente novamente.' });
  }
};
