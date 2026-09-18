'use strict';

const { verificarAcesso } = require('../../lib/cal/handlers/verificar');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { t: magicToken } = req.query || {};

  try {
    const r = await verificarAcesso({ magicToken });
    if (r.setCookie) res.setHeader('Set-Cookie', r.setCookie);
    return res.status(r.status).json(r.body);
  } catch (err) {
    console.error('cal/verificar error:', err.message);
    return res.status(502).json({ error: 'Não foi possível confirmar o acesso. Tente novamente.' });
  }
};
