'use strict';

/**
 * POST /api/cal/lancamento — cria uma linha nova em CUSTO_FIXO. Exige sessão.
 *
 * "Repetir todo mês" vira Data_Início = 1º dia do mês escolhido e Data_Fim em
 * aberto (recorre pra sempre, igual a um custo fixo real). Sem repetição,
 * Data_Início = Data_Fim = mesmo mês — a janela de validade em projection.js
 * já garante que só ocorre naquele mês, sem precisar de um "Frequência"
 * especial pra evento único.
 */

const auth = require('../auth');
const sheets = require('../sheets');
const escrita = require('../escrita');
const { primeiroDia, ultimoDia, diasNoMes } = require('../dates');

function paraBr(iso) {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

async function criarLancamento({ cookies, nome, valor, categoria, dia, mes, repetirTodoMes = true }) {
  const sessao = auth.lerSessao(cookies);
  if (!sessao) {
    return { status: 401, body: { error: 'Faça login para adicionar pagamentos.' } };
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

  const dataInicio = paraBr(primeiroDia(mes));
  const dataFim = repetirTodoMes ? '' : paraBr(ultimoDia(mes));

  const valores = await sheets.getValues(sessao.sid, 'CUSTO_FIXO!A1:Z2000');
  const header = escrita.cabecalhoCusto(valores);
  const linha = escrita.montarLinha(header, [
    { rotulos: ['Custo'], valor: nomeLimpo },
    { rotulos: ['Valor'], valor: valorNum },
    { rotulos: ['Categoria'], valor: categoria || '' },
    { rotulos: ['Dia_Vencimento'], valor: String(diaNum) },
    { rotulos: ['Frequência', 'Frequencia'], valor: 'Mensal' },
    { rotulos: ['Data_Início', 'Data_Inicio'], valor: dataInicio },
    { rotulos: ['Data_Fim'], valor: dataFim },
    { rotulos: ['Status'], valor: 'Ativo' },
    { rotulos: ['Status_Pagamento'], valor: 'Pendente' },
  ]);

  await sheets.appendRow(sessao.sid, 'CUSTO_FIXO', linha);
  return { status: 201, body: { ok: true } };
}

module.exports = { criarLancamento };
