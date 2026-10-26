'use strict';

const auth = require('../auth');
const sheets = require('../sheets');
const escrita = require('../escrita');
const schema = require('../schema');
const { gerarId } = require('../ids');
const { primeiroDia, ultimoDia, paraBr, diasNoMes, frequenciaCanonica } = require('../dates');

const FREQ_VALIDAS = new Set(['Mensal', 'Única']);

async function criarReserva({ cookies, nome, valor, dia, frequencia, mes, repetirTodoMes = true }) {
  const sessao = auth.lerSessao(cookies);
  if (!sessao) {
    return { status: 401, body: { error: 'Faça login para adicionar reservas.' } };
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

  const dataInicio = paraBr(primeiroDia(mes));
  const dataFim = repetirTodoMes ? '' : paraBr(ultimoDia(mes));

  const valores = await sheets.getValues(sessao.sid, 'RESERVAS!A1:Z2000');
  const header = escrita.cabecalhoReserva(valores);
  const campos = [
    { rotulos: ['Nome', 'Reserva'], valor: nomeLimpo },
    { rotulos: ['Valor'], valor: valorNum },
    { rotulos: ['Frequência', 'Frequencia'], valor: freq },
    { rotulos: ['Dia', 'Dia_Reserva'], valor: String(diaNum) },
    { rotulos: ['Data_Início', 'Data_Inicio'], valor: dataInicio },
    { rotulos: ['Data_Fim'], valor: dataFim },
    { rotulos: ['Status'], valor: 'Ativo' },
  ];
  if (escrita.indiceColuna(header, 'ID') != null) {
    campos.push({ rotulos: ['ID'], valor: gerarId(schema.parseReserva(valores).map((r) => r.id).filter(Boolean), 'r-') });
  }
  const linha = escrita.montarLinha(header, campos);

  await sheets.appendRow(sessao.sid, 'RESERVAS', linha);
  return { status: 201, body: { ok: true } };
}

module.exports = { criarReserva };
