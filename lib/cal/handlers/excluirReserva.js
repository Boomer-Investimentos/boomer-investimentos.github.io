'use strict';

/**
 * POST /api/cal/reserva (acao: 'excluir') — exclusão de uma reserva.
 * Reserva não tem conceito de parcelas, então a exclusão sempre remove a
 * linha física da planilha, junto com o histórico de valores guardados
 * correspondente em HISTORICO_RESERVAS.
 */

const auth = require('../auth');
const sheets = require('../sheets');
const escrita = require('../escrita');
const schema = require('../schema');

const ABA_HISTORICO = 'HISTORICO_RESERVAS';
const ABA_AUSENTE_RE = /Unable to parse range/i;

async function lerAbaHistorico(sid) {
  try {
    return await sheets.getValues(sid, `${ABA_HISTORICO}!A1:Z2000`);
  } catch (err) {
    if (err instanceof Error && ABA_AUSENTE_RE.test(err.message)) return null;
    throw err;
  }
}

/** Linhas (1-based) do histórico que pertencem a essa reserva (por ID, ou por nome quando não há ID). */
function linhasHistoricoDaReserva(valoresHistorico, chaveAlvo) {
  const header = schema.localizarTabela(valoresHistorico, schema.ROTULOS_HISTORICO_RESERVAS).header;
  const idxId = escrita.indiceColuna(header, 'ID');
  const idxNome = escrita.indiceColuna(header, 'Reserva', 'Nome');
  const linhas = [];
  for (let i = 1; i < valoresHistorico.length; i += 1) {
    const row = valoresHistorico[i];
    if (!row) continue;
    const idRow = idxId != null ? row[idxId] : '';
    const nomeRow = idxNome != null ? row[idxNome] : '';
    const chave = schema.norm(idRow || nomeRow);
    if (chave && chave === chaveAlvo) linhas.push(i + 1);
  }
  return linhas;
}

async function excluirReserva({ cookies, linhaPlanilha, id }) {
  const sessao = auth.lerSessao(cookies);
  if (!sessao) {
    return { status: 401, body: { error: 'Faça login para excluir reservas.' } };
  }

  const linha = Number(linhaPlanilha);
  if (!Number.isInteger(linha) || linha < 2) {
    return { status: 400, body: { error: 'linhaPlanilha inválida.' } };
  }

  const valores = await sheets.getValues(sessao.sid, 'RESERVAS!A1:Z2000');
  const header = escrita.cabecalhoReserva(valores);
  const linhaAtual = valores[linha - 1];
  if (!linhaAtual) {
    return { status: 404, body: { error: 'Linha não encontrada.' } };
  }
  if (!escrita.conferirId(header, linhaAtual, id)) {
    return { status: 409, body: { error: 'Esta reserva foi alterada em outra sessão. Atualize a página e tente de novo.' } };
  }

  const reserva = schema.parseReserva(valores).find((r) => r.linhaPlanilha === linha);

  const valoresHistorico = await lerAbaHistorico(sessao.sid);
  if (valoresHistorico && reserva) {
    const chaveAlvo = schema.norm(reserva.id || reserva.nome);
    const linhasHistorico = linhasHistoricoDaReserva(valoresHistorico, chaveAlvo);
    if (linhasHistorico.length) await sheets.deleteRows(sessao.sid, ABA_HISTORICO, linhasHistorico);
  }

  await sheets.deleteRows(sessao.sid, 'RESERVAS', [linha]);
  return { status: 200, body: { ok: true, modo: 'excluido' } };
}

module.exports = { excluirReserva };
