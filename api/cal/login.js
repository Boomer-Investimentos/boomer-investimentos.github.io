'use strict';

const { pedirAcesso } = require('../../lib/cal/handlers/login');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { s: linkToken, email } = req.body || {};

  try {
    const r = await pedirAcesso({ linkToken, email });
    return res.status(r.status).json(r.body);
  } catch (err) {
    console.error('cal/login error:', err.message);
    return res.status(502).json({ error: 'Não foi possível enviar o link de acesso. Tente novamente.' });
  }
};
