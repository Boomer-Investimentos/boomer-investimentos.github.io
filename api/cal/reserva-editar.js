'use strict';

const auth = require('../../lib/cal/auth');
const { editarReserva } = require('../../lib/cal/handlers/editarReserva');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const cookies = auth.parseCookies(req.headers.cookie);
  const { linhaPlanilha, nome, valor, dia, frequencia, mes, repetirTodoMes, status } = req.body || {};

  try {
    const r = await editarReserva({ cookies, linhaPlanilha, nome, valor, dia, frequencia, mes, repetirTodoMes, status });
    return res.status(r.status).json(r.body);
  } catch (err) {
    console.error('cal/reserva-editar error:', err.message);
    return res.status(502).json({ error: 'Não foi possível salvar. Tente novamente.' });
  }
};
