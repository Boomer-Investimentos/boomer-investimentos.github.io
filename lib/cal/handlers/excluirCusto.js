'use strict';

/**
 * POST /api/cal/custo-editar (acao: 'excluir') — exclusão de um custo.
 * Regra: exclusão remove a linha física da planilha (e o histórico de
 * pagamento correspondente em HISTORICO_CUSTOS). A única exceção é um custo
 * parcelado que já terminou todas as parcelas (Data_Fim no passado): nesse
 * caso vira só Inativo (soft delete), pra preservar o vínculo com o
 * histórico de parcelas já pagas.
 */

const auth = require('../auth');
const sheets = require('../sheets');
const escrita = require('../escrita');
const schema = require('../schema');
const { hojeISO } = require('../dates');

const ABA_HISTORICO = 'HISTORICO_CUSTOS';
const ABA_AUSENTE_RE = /Unable to parse range/i;

async function lerAbaHistorico(sid) {
  try {
    return await sheets.getValues(sid, `${ABA_HISTORICO}!A1:Z2000`);
  } catch (err) {
    if (err instanceof Error && ABA_AUSENTE_RE.test(err.message)) return null;
    throw err;
  }
}

/** Linhas (1-based) do histórico que pertencem a esse custo (por ID, ou por nome quando não há ID). */
function linhasHistoricoDoCusto(valoresHistorico, chaveAlvo) {
  const header = schema.localizarTabela(valoresHistorico, schema.ROTULOS_HISTORICO).header;
  const idxId = escrita.indiceColuna(header, 'ID');
  const idxNome = escrita.indiceColuna(header, 'Custo');
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

async function excluirCusto({ cookies, linhaPlanilha, id }) {
  const sessao = auth.lerSessao(cookies);
  if (!sessao) {
    return { status: 401, body: { error: 'Faça login para excluir custos.' } };
  }

  const linha = Number(linhaPlanilha);
  if (!Number.isInteger(linha) || linha < 2) {
    return { status: 400, body: { error: 'linhaPlanilha inválida.' } };
  }

  const valores = await sheets.getValues(sessao.sid, 'CUSTO_FIXO!A1:Z2000');
  const header = escrita.cabecalhoCusto(valores);
  const linhaAtual = valores[linha - 1];
  if (!linhaAtual) {
    return { status: 404, body: { error: 'Linha não encontrada.' } };
  }
  if (!escrita.conferirId(header, linhaAtual, id)) {
    return { status: 409, body: { error: 'Este custo foi alterado em outra sessão. Atualize a página e tente de novo.' } };
  }

  const custo = schema.parseCusto(valores).find((c) => c.linhaPlanilha === linha);
  const idxTotal = escrita.indiceColuna(header, 'Total_Parcelas');
  const parcelado = idxTotal != null && Number(linhaAtual[idxTotal]) > 0;
  const parceladoFinalizado = parcelado && !!(custo && custo.dataFim) && custo.dataFim < hojeISO();

  if (parceladoFinalizado) {
    const linhaEditada = escrita.mesclarLinha(header, linhaAtual, [{ rotulos: ['Status'], valor: 'Inativo' }]);
    await sheets.updateRow(sessao.sid, 'CUSTO_FIXO', linha, linhaEditada);
    return { status: 200, body: { ok: true, modo: 'inativado' } };
  }

  const valoresHistorico = await lerAbaHistorico(sessao.sid);
  if (valoresHistorico && custo) {
    const chaveAlvo = schema.norm(schema.chaveCusto(custo));
    const linhasHistorico = linhasHistoricoDoCusto(valoresHistorico, chaveAlvo);
    if (linhasHistorico.length) await sheets.deleteRows(sessao.sid, ABA_HISTORICO, linhasHistorico);
  }

  await sheets.deleteRows(sessao.sid, 'CUSTO_FIXO', [linha]);
  return { status: 200, body: { ok: true, modo: 'excluido' } };
}

module.exports = { excluirCusto };
