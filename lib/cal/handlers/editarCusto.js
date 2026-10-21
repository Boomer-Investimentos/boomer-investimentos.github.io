'use strict';

const auth = require('../auth');
const sheets = require('../sheets');
const escrita = require('../escrita');
const { norm: schemaNorm } = require('../schema');
const { ultimoDia, diasNoMes, paraBr, serialParaData, numeroParcela } = require('../dates');

const STATUS_VALIDOS = new Set(['Ativo', 'Inativo']);

async function editarCusto({ cookies, linhaPlanilha, nome, valor, categoria, dia, mes, repetirTodoMes, status, parcelas, parcelaAtual }) {
  const sessao = auth.lerSessao(cookies);
  if (!sessao) {
    return { status: 401, body: { error: 'Faça login para editar pagamentos.' } };
  }

  const linha = Number(linhaPlanilha);
  if (!Number.isInteger(linha) || linha < 2) {
    return { status: 400, body: { error: 'linhaPlanilha inválida.' } };
  }

  const nomeLimpo = String(nome || '').trim();
  const valorNum = Number(valor);
  const diaNum = Number(dia);
  if (!nomeLimpo) return { status: 400, body: { error: 'Informe uma descrição.' } };
  if (!Number.isFinite(valorNum) || valorNum <= 0) return { status: 400, body: { error: 'Valor inválido.' } };
  if (!/^\d{4}-\d{2}$/.test(mes || '')) return { status: 400, body: { error: 'Mês inválido.' } };
  if (!Number.isInteger(diaNum) || diaNum < 1 || diaNum > diasNoMes(mes)) {
    return { status: 400, body: { error: 'Dia inválido para o mês informado.' } };
  }
  if (status !== undefined && !STATUS_VALIDOS.has(status)) {
    return { status: 400, body: { error: 'status deve ser "Ativo" ou "Inativo".' } };
  }

  const valores = await sheets.getValues(sessao.sid, 'CUSTO_FIXO!A1:Z2000');
  const header = escrita.cabecalhoCusto(valores);
  const linhaAtual = valores[linha - 1];
  if (!linhaAtual) {
    return { status: 404, body: { error: 'Linha não encontrada.' } };
  }

  const idxNome = escrita.indiceColuna(header, 'Custo');
  const nomeAtual = idxNome == null ? '' : schemaNorm(linhaAtual[idxNome]);
  if (schemaNorm(nomeLimpo) !== nomeAtual && escrita.nomeCustoEmUso(valores, nomeLimpo, linha)) {
    return { status: 409, body: { error: escrita.mensagemNomeRepetido(valores, nomeLimpo) } };
  }

  // Parcelado: Data_Fim é derivada de Total_Parcelas, então repetirTodoMes não
  // vale (truncaria as parcelas). Só mexe nas datas se vierem parcelas.
  const idxTotal = escrita.indiceColuna(header, 'Total_Parcelas');
  const parcelado = idxTotal != null && Number(linhaAtual[idxTotal]) > 0;
  const pediuParcelas = parcelas != null && parcelas !== '';
  if (pediuParcelas && !parcelado) {
    return { status: 400, body: { error: 'Só é possível alterar parcelas de um custo que já é parcelado.' } };
  }
  let camposParcelas = {};
  if (pediuParcelas) {
    let atual = parcelaAtual;
    if (atual == null || atual === '') {
      const idxInicio = escrita.indiceColuna(header, 'Data_Início', 'Data_Inicio');
      const inicioAtual = idxInicio == null ? null : serialParaData(linhaAtual[idxInicio]);
      atual = inicioAtual ? numeroParcela(inicioAtual, mes) : undefined;
    }
    camposParcelas = escrita.camposParcelado({ parcelas, parcelaAtual: atual, mes });
    if (camposParcelas.erro) return { status: 400, body: { error: camposParcelas.erro } };
  }

  const dataFim = parcelado ? camposParcelas.dataFim : (repetirTodoMes ? '' : paraBr(ultimoDia(mes)));

  const linhaEditada = escrita.mesclarLinha(header, linhaAtual, [
    { rotulos: ['Custo'], valor: nomeLimpo },
    { rotulos: ['Valor'], valor: valorNum },
    { rotulos: ['Categoria'], valor: categoria || '' },
    { rotulos: ['Dia_Vencimento'], valor: String(diaNum) },
    { rotulos: ['Total_Parcelas'], valor: camposParcelas.totalParcelas },
    { rotulos: ['Data_Início', 'Data_Inicio'], valor: camposParcelas.dataInicio },
    { rotulos: ['Data_Fim'], valor: dataFim },
    { rotulos: ['Status'], valor: status },
  ]);

  await sheets.updateRow(sessao.sid, 'CUSTO_FIXO', linha, linhaEditada);
  return { status: 200, body: { ok: true } };
}

module.exports = { editarCusto };
