'use strict';

/**
 * POST /api/cal/reserva — endpoint único de reserva (criar/editar/guardar).
 * Unificado em uma só função para caber no limite de Serverless Functions do
 * plano Vercel; a `acao` do corpo escolhe o handler.
 */

const auth = require('../../lib/cal/auth');
const { criarReserva } = require('../../lib/cal/handlers/lancamentoReserva');
const { editarReserva } = require('../../lib/cal/handlers/editarReserva');
const { atualizarReserva } = require('../../lib/cal/handlers/reservaGuardado');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const cookies = auth.parseCookies(req.headers.cookie);
  const body = req.body || {};

  try {
    let r;
    if (body.acao === 'criar') r = await criarReserva({ cookies, ...body });
    else if (body.acao === 'editar') r = await editarReserva({ cookies, ...body });
    else if (body.acao === 'guardar') r = await atualizarReserva({ cookies, ...body });
    else return res.status(400).json({ error: 'Ação de reserva inválida.' });
    return res.status(r.status).json(r.body);
  } catch (err) {
    console.error('cal/reserva error:', err.message);
    return res.status(502).json({ error: 'Não foi possível salvar. Tente novamente.' });
  }
};
