'use strict';

const auth = require('../../lib/cal/auth');
const { criarRenda } = require('../../lib/cal/handlers/lancamentoRenda');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const cookies = auth.parseCookies(req.headers.cookie);
  const { fonte, valor, frequencia, diaRecebimento, mes, repetirTodoMes } = req.body || {};

  try {
    const r = await criarRenda({ cookies, fonte, valor, frequencia, diaRecebimento, mes, repetirTodoMes });
    return res.status(r.status).json(r.body);
  } catch (err) {
    console.error('cal/renda-lancamento error:', err.message);
    return res.status(502).json({ error: 'Não foi possível salvar. Tente novamente.' });
  }
};
