'use strict';

const auth = require('../../lib/cal/auth');
const { editarRenda } = require('../../lib/cal/handlers/editarRenda');
const { excluirRenda } = require('../../lib/cal/handlers/excluirRenda');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const cookies = auth.parseCookies(req.headers.cookie);
  const body = req.body || {};
  const { linhaPlanilha, id, fonte, valor, frequencia, diaRecebimento, mes, repetirTodoMes, status } = body;

  try {
    const r = body.acao === 'excluir'
      ? await excluirRenda({ cookies, linhaPlanilha, id })
      : await editarRenda({ cookies, linhaPlanilha, id, fonte, valor, frequencia, diaRecebimento, mes, repetirTodoMes, status });
    return res.status(r.status).json(r.body);
  } catch (err) {
    console.error('cal/renda-editar error:', err.message);
    return res.status(502).json({ error: 'Não foi possível salvar. Tente novamente.' });
  }
};
