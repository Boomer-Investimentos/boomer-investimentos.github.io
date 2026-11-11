'use strict';

const auth = require('../../lib/cal/auth');
const { editarCusto } = require('../../lib/cal/handlers/editarCusto');
const { excluirCusto } = require('../../lib/cal/handlers/excluirCusto');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const cookies = auth.parseCookies(req.headers.cookie);
  const body = req.body || {};
  const { linhaPlanilha, id, nome, valor, categoria, dia, mes, repetirTodoMes, status, parcelas, parcelaAtual } = body;

  try {
    const r = body.acao === 'excluir'
      ? await excluirCusto({ cookies, linhaPlanilha, id })
      : await editarCusto({ cookies, linhaPlanilha, id, nome, valor, categoria, dia, mes, repetirTodoMes, status, parcelas, parcelaAtual });
    return res.status(r.status).json(r.body);
  } catch (err) {
    console.error('cal/custo-editar error:', err.message);
    return res.status(502).json({ error: 'Não foi possível salvar. Tente novamente.' });
  }
};
