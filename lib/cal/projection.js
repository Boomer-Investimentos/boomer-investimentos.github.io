'use strict';

/**
 * Projeta RENDA + CUSTO_FIXO (já normalizados por schema.js) num mês
 * calendário: expande recorrências (semanal/mensal, parcelas, parâmetros de
 * validade) em ocorrências datadas, monta os totais (pago/pendente/atrasado/
 * receita) e separa custos sem dia parseável (semData).
 *
 * Puro — não lê planilha nem sabe de HTTP. Só depende de dates.js,
 * categories.js e schema.norm.
 */

const {
  diasNoMes,
  ocorrenciasDeDiaDaSemana,
  parseDiaVencimento,
  clampDia,
  ultimoDia,
  hojeISO,
} = require('./dates');
const { categoria, legenda } = require('./categories');
const { norm } = require('./schema');

function pad2(n) {
  return String(n).padStart(2, '0');
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function dentroDaJanela(data, dataInicio, dataFim) {
  if (dataInicio && data < dataInicio) return false;
  if (dataFim && data > dataFim) return false;
  return true;
}

function statusPago(statusPagamento) {
  return norm(statusPagamento) === 'pago';
}

/**
 * Data_Fim efetiva pra checar a janela. "Única" sem Data_Fim (e sem parcelas —
 * aí schema.js já preenche Data_Fim) é um evento de um mês só: trava no fim
 * do mês de Data_Início, senão recorreria pra sempre igual a "Mensal".
 */
function limiteSuperior(item) {
  if (item.dataFim) return item.dataFim;
  if (norm(item.frequencia) === 'unica' && item.dataInicio) {
    return ultimoDia(item.dataInicio.slice(0, 7));
  }
  return null;
}

/** Datas (YYYY-MM-DD) em que um custo mensal ocorre no mês-alvo (0 ou 1 data). */
function ocorrenciasCusto(item, mes) {
  if (item.dia == null) return [];
  const dia = clampDia(item.dia, mes);
  const data = `${mes}-${pad2(dia)}`;
  if (!dentroDaJanela(data, item.dataInicio, limiteSuperior(item))) return [];
  return [data];
}

/** Datas (YYYY-MM-DD) em que uma renda ocorre no mês-alvo. */
function ocorrenciasRenda(item, mes) {
  const dataFim = limiteSuperior(item);
  if (norm(item.frequencia) === 'semanal') {
    return ocorrenciasDeDiaDaSemana(mes, item.diaRecebimento)
      .map((dia) => `${mes}-${pad2(dia)}`)
      .filter((data) => dentroDaJanela(data, item.dataInicio, dataFim));
  }
  const dia = parseDiaVencimento(item.diaRecebimento);
  if (dia == null) return [];
  const data = `${mes}-${pad2(clampDia(dia, mes))}`;
  return dentroDaJanela(data, item.dataInicio, dataFim) ? [data] : [];
}

function montarItemCusto(item, data, hoje) {
  const pago = statusPago(item.statusPagamento);
  return {
    tipo: 'custo',
    nome: item.custo,
    valor: item.valor,
    categoria: categoria(item.categoria),
    data,
    statusPagamento: pago ? 'pago' : 'pendente',
    atrasado: !pago && data != null && data < hoje,
    linhaPlanilha: item.linhaPlanilha,
    aba: 'CUSTO_FIXO',
  };
}

function montarItemRenda(item, data, hoje) {
  return {
    tipo: 'renda',
    nome: item.fonte,
    valor: item.valor,
    categoria: categoria('Recebimento'),
    data,
    recebido: data <= hoje,
  };
}

function totaisIniciais() {
  return { pago: 0, pendente: 0, atrasado: 0, receita: 0 };
}

function acumularCusto(totais, item) {
  if (item.atrasado) totais.atrasado += item.valor;
  else if (item.statusPagamento === 'pago') totais.pago += item.valor;
  else totais.pendente += item.valor;
}

/**
 * @param {object} p
 * @param {Array} p.renda - schema.parseRenda(...)
 * @param {Array} p.custo - schema.parseCusto(...)
 * @param {string} p.mes - "YYYY-MM"
 * @param {string} [p.hoje] - "YYYY-MM-DD", default hojeISO()
 */
function projetarMes({ renda, custo, mes, hoje = hojeISO() }) {
  const total = diasNoMes(mes);
  const dias = [];
  for (let d = 1; d <= total; d += 1) {
    dias.push({ data: `${mes}-${pad2(d)}`, dia: d, itens: [] });
  }

  const totais = totaisIniciais();
  const semData = [];

  for (const item of custo || []) {
    if (!item.ativo) continue;
    if (item.dia == null) {
      const pago = statusPago(item.statusPagamento);
      const view = {
        tipo: 'custo',
        nome: item.custo,
        valor: item.valor,
        categoria: categoria(item.categoria),
        diaTexto: item.diaTexto,
        statusPagamento: pago ? 'pago' : 'pendente',
        atrasado: false,
        linhaPlanilha: item.linhaPlanilha,
        aba: 'CUSTO_FIXO',
      };
      semData.push(view);
      acumularCusto(totais, view);
      continue;
    }
    for (const data of ocorrenciasCusto(item, mes)) {
      const view = montarItemCusto(item, data, hoje);
      dias[Number(data.slice(-2)) - 1].itens.push(view);
      acumularCusto(totais, view);
    }
  }

  for (const item of renda || []) {
    if (!item.ativo) continue;
    for (const data of ocorrenciasRenda(item, mes)) {
      const view = montarItemRenda(item, data, hoje);
      dias[Number(data.slice(-2)) - 1].itens.push(view);
      totais.receita += item.valor;
    }
  }

  totais.pago = round2(totais.pago);
  totais.pendente = round2(totais.pendente);
  totais.atrasado = round2(totais.atrasado);
  totais.receita = round2(totais.receita);

  return { mes, hoje, dias, semData, totals: totais, categorias: legenda() };
}

module.exports = { projetarMes };
