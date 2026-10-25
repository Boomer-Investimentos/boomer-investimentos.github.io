'use strict';

const auth = require('../../lib/cal/auth');
const { atualizarReserva } = require('../../lib/cal/handlers/reservaGuardado');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const cookies = auth.parseCookies(req.headers.cookie);
  const { linhaPlanilha, statusReserva, mes } = req.body || {};

  try {
    const r = await atualizarReserva({ cookies, linhaPlanilha, statusReserva, mes });
    return res.status(r.status).json(r.body);
  } catch (err) {
    console.error('cal/reserva-guardado error:', err.message);
    return res.status(502).json({ error: 'Não foi possível salvar. Tente novamente.' });
  }
};
