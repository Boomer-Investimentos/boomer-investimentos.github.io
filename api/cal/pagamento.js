'use strict';

const auth = require('../../lib/cal/auth');
const { atualizarPagamento } = require('../../lib/cal/handlers/pagamento');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const cookies = auth.parseCookies(req.headers.cookie);
  const { linhaPlanilha, statusPagamento } = req.body || {};

  try {
    const r = await atualizarPagamento({ cookies, linhaPlanilha, statusPagamento });
    return res.status(r.status).json(r.body);
  } catch (err) {
    console.error('cal/pagamento error:', err.message);
    return res.status(502).json({ error: 'Não foi possível salvar. Tente novamente.' });
  }
};
