'use strict';

/**
 * POST /api/cal/renda-editar (acao: 'excluir') — exclusão de uma renda.
 * Renda não tem parcelas nem histórico próprio (sem HISTORICO_RENDA), então
 * a exclusão sempre remove a linha física da planilha.
 */

const auth = require('../auth');
const sheets = require('../sheets');
const escrita = require('../escrita');

async function excluirRenda({ cookies, linhaPlanilha, id }) {
  const sessao = auth.lerSessao(cookies);
  if (!sessao) {
    return { status: 401, body: { error: 'Faça login para excluir renda.' } };
  }

  const linha = Number(linhaPlanilha);
  if (!Number.isInteger(linha) || linha < 2) {
    return { status: 400, body: { error: 'linhaPlanilha inválida.' } };
  }

  const valores = await sheets.getValues(sessao.sid, 'RENDA!A1:Z2000');
  const header = escrita.cabecalhoRenda(valores);
  const linhaAtual = valores[linha - 1];
  if (!linhaAtual) {
    return { status: 404, body: { error: 'Linha não encontrada.' } };
  }
  if (!escrita.conferirId(header, linhaAtual, id)) {
    return { status: 409, body: { error: 'Esta renda foi alterada em outra sessão. Atualize a página e tente de novo.' } };
  }

  await sheets.deleteRows(sessao.sid, 'RENDA', [linha]);
  return { status: 200, body: { ok: true, modo: 'excluido' } };
}

module.exports = { excluirRenda };
