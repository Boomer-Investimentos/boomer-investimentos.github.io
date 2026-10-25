'use strict';

const auth = require('../auth');
const sheets = require('../sheets');
const escrita = require('../escrita');
const { ultimoDia, paraBr, diasNoMes, frequenciaCanonica } = require('../dates');

const STATUS_VALIDOS = new Set(['Ativo', 'Inativo']);
const FREQ_VALIDAS = new Set(['Mensal', 'Única']);

async function editarReserva({ cookies, linhaPlanilha, nome, valor, dia, frequencia, mes, repetirTodoMes, status }) {
  const sessao = auth.lerSessao(cookies);
  if (!sessao) {
    return { status: 401, body: { error: 'Faça login para editar reservas.' } };
  }

  const linha = Number(linhaPlanilha);
  if (!Number.isInteger(linha) || linha < 2) {
    return { status: 400, body: { error: 'linhaPlanilha inválida.' } };
  }

  const nomeLimpo = String(nome || '').trim();
  const valorNum = Number(valor);
  const diaNum = Number(dia);
  const freq = frequenciaCanonica(frequencia) || 'Mensal';
  if (!nomeLimpo) return { status: 400, body: { error: 'Informe uma descrição.' } };
  if (!Number.isFinite(valorNum) || valorNum <= 0) return { status: 400, body: { error: 'Valor inválido.' } };
  if (!/^\d{4}-\d{2}$/.test(mes || '')) return { status: 400, body: { error: 'Mês inválido.' } };
  if (!Number.isInteger(diaNum) || diaNum < 1 || diaNum > diasNoMes(mes)) {
    return { status: 400, body: { error: 'Dia inválido para o mês informado.' } };
  }
  if (!FREQ_VALIDAS.has(freq)) {
    return { status: 400, body: { error: 'Frequência deve ser "Mensal" ou "Única".' } };
  }
  if (status !== undefined && !STATUS_VALIDOS.has(status)) {
    return { status: 400, body: { error: 'status deve ser "Ativo" ou "Inativo".' } };
  }

  const valores = await sheets.getValues(sessao.sid, 'RESERVAS!A1:Z2000');
  const header = escrita.cabecalhoReserva(valores);
  const linhaAtual = valores[linha - 1];
  if (!linhaAtual) {
    return { status: 404, body: { error: 'Linha não encontrada.' } };
  }

  const linhaEditada = escrita.mesclarLinha(header, linhaAtual, [
    { rotulos: ['Reserva'], valor: nomeLimpo },
    { rotulos: ['Valor'], valor: valorNum },
    { rotulos: ['Frequência', 'Frequencia'], valor: freq },
    { rotulos: ['Dia', 'Dia_Reserva'], valor: String(diaNum) },
    { rotulos: ['Data_Fim'], valor: repetirTodoMes ? '' : paraBr(ultimoDia(mes)) },
    { rotulos: ['Status'], valor: status },
  ]);

  await sheets.updateRow(sessao.sid, 'RESERVAS', linha, linhaEditada);
  return { status: 200, body: { ok: true } };
}

module.exports = { editarReserva };
