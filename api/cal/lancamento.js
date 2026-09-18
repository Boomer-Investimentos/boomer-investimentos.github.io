'use strict';

const auth = require('../../lib/cal/auth');
const { criarLancamento } = require('../../lib/cal/handlers/lancamento');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const cookies = auth.parseCookies(req.headers.cookie);
  const { nome, valor, categoria, dia, mes, repetirTodoMes } = req.body || {};

  try {
    const r = await criarLancamento({ cookies, nome, valor, categoria, dia, mes, repetirTodoMes });
    return res.status(r.status).json(r.body);
  } catch (err) {
    console.error('cal/lancamento error:', err.message);
    return res.status(502).json({ error: 'Não foi possível salvar. Tente novamente.' });
  }
};
