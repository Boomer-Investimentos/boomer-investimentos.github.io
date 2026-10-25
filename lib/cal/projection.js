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
const { norm, chaveHistorico, chaveCusto } = require('./schema');

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

/** Pago no mês = há valor na coluna do mês em HISTORICO_CUSTOS (por ID ou nome). */
function custoPagoNoMes(item, mes, historico, nomeUnico) {
  const ano = mes.slice(0, 4);
  const mesNum = Number(mes.slice(5, 7));
  const reg = historico && historico[chaveHistorico(chaveCusto(item), ano)];
  if (reg) return reg.meses[mesNum] > 0;
  // Custo já com ID, mas histórico ainda chaveado por nome (antes da adoção):
  // cai no registro antigo só se o nome for único.
  if (item.id && nomeUnico) {
    const porNome = historico && historico[chaveHistorico(norm(item.custo), ano)];
    if (porNome && !porNome.idKeyed) return porNome.meses[mesNum] > 0;
  }
  return false;
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

function montarItemCusto(item, data, hoje, pago) {
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
    repete: !item.dataFim,
  };
}

/** Guardado no mês = há valor na coluna do mês em HISTORICO_RESERVAS (ID ou nome). */
function reservaGuardadaNoMes(item, mes, historico, nomeUnico) {
  const ano = mes.slice(0, 4);
  const mesNum = Number(mes.slice(5, 7));
  const reg = historico && historico[chaveHistorico(item.id || item.nome, ano)];
  if (reg) return reg.meses[mesNum] > 0;
  // Reserva já com ID, mas histórico ainda chaveado por nome (antes da adoção):
  // só casa pelo registro antigo se o nome for único.
  if (item.id && nomeUnico) {
    const porNome = historico && historico[chaveHistorico(norm(item.nome), ano)];
    if (porNome && !porNome.idKeyed) return porNome.meses[mesNum] > 0;
  }
  return false;
}

/** Reserva nunca atrasa: ocorrência não marcada só não entra no total. */
function montarItemReserva(item, data, guardado) {
  return {
    tipo: 'reserva',
    nome: item.nome,
    valor: item.valor,
    categoria: categoria('Reserva'),
    data,
    statusReserva: guardado ? 'guardado' : 'pendente',
    atrasado: false,
    linhaPlanilha: item.linhaPlanilha,
    aba: 'RESERVAS',
    repete: !item.dataFim,
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
    frequencia: item.frequencia,
    diaRecebimento: item.diaRecebimento,
    linhaPlanilha: item.linhaPlanilha,
    aba: 'RENDA',
    repete: !item.dataFim,
  };
}

function totaisIniciais() {
  return { pago: 0, pendente: 0, atrasado: 0, receita: 0, reservado: 0 };
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
 * @param {object} [p.historico] - schema.parseHistorico(...)
 * @param {Array} [p.reservas] - schema.parseReserva(...)
 * @param {object} [p.historicoReservas] - schema.parseHistorico(..., 'Reserva')
 * @param {string} [p.hoje] - "YYYY-MM-DD", default hojeISO()
 */
function projetarMes({ renda, custo, mes, historico, reservas, historicoReservas, hoje = hojeISO() }) {
  const total = diasNoMes(mes);
  const dias = [];
  for (let d = 1; d <= total; d += 1) {
    dias.push({ data: `${mes}-${pad2(d)}`, dia: d, itens: [] });
  }

  const totais = totaisIniciais();
  const semData = [];

  const contagemNome = {};
  for (const c of custo || []) {
    const k = norm(c.custo);
    if (k) contagemNome[k] = (contagemNome[k] || 0) + 1;
  }

  for (const item of custo || []) {
    if (!item.ativo) continue;
    const pago = custoPagoNoMes(item, mes, historico, contagemNome[norm(item.custo)] === 1);
    if (item.dia == null) {
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
        repete: !item.dataFim,
      };
      semData.push(view);
      acumularCusto(totais, view);
      continue;
    }
    for (const data of ocorrenciasCusto(item, mes)) {
      const view = montarItemCusto(item, data, hoje, pago);
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

  const contagemNomeReserva = {};
  for (const r of reservas || []) {
    const k = norm(r.nome);
    if (k) contagemNomeReserva[k] = (contagemNomeReserva[k] || 0) + 1;
  }

  for (const item of reservas || []) {
    if (!item.ativo || item.dia == null) continue;
    const guardado = reservaGuardadaNoMes(item, mes, historicoReservas, contagemNomeReserva[norm(item.nome)] === 1);
    for (const data of ocorrenciasCusto(item, mes)) {
      const view = montarItemReserva(item, data, guardado);
      dias[Number(data.slice(-2)) - 1].itens.push(view);
      if (guardado) totais.reservado += item.valor;
    }
  }

  totais.pago = round2(totais.pago);
  totais.pendente = round2(totais.pendente);
  totais.atrasado = round2(totais.atrasado);
  totais.receita = round2(totais.receita);
  totais.reservado = round2(totais.reservado);

  return { mes, hoje, dias, semData, totals: totais, categorias: legenda() };
}

module.exports = { projetarMes };
