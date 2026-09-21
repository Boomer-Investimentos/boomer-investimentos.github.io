'use strict';

const auth = require('../auth');
const sheets = require('../sheets');
const escrita = require('../escrita');
const { primeiroDia, ultimoDia, paraBr, diaRecebimentoValido, frequenciaCanonica } = require('../dates');

async function criarRenda({ cookies, fonte, valor, frequencia, diaRecebimento, mes, repetirTodoMes = true }) {
  const sessao = auth.lerSessao(cookies);
  if (!sessao) {
    return { status: 401, body: { error: 'Faça login para adicionar renda.' } };
  }

  const fonteLimpa = String(fonte || '').trim();
  const valorNum = Number(valor);
  const frequenciaLimpa = frequenciaCanonica(frequencia);
  if (!fonteLimpa) return { status: 400, body: { error: 'Informe a fonte da renda.' } };
  if (!Number.isFinite(valorNum) || valorNum <= 0) return { status: 400, body: { error: 'Valor inválido.' } };
  if (!/^\d{4}-\d{2}$/.test(mes || '')) return { status: 400, body: { error: 'Mês inválido.' } };
  if (!frequenciaLimpa) {
    return { status: 400, body: { error: 'Frequência deve ser "Mensal", "Semanal" ou "Única".' } };
  }
  const erroDia = diaRecebimentoValido(frequenciaLimpa, diaRecebimento, mes);
  if (erroDia) return { status: 400, body: { error: erroDia } };

  const dataInicio = paraBr(primeiroDia(mes));
  const dataFim = repetirTodoMes ? '' : paraBr(ultimoDia(mes));

  const valores = await sheets.getValues(sessao.sid, 'RENDA!A1:Z2000');
  const header = escrita.cabecalhoRenda(valores);
  const linha = escrita.montarLinha(header, [
    { rotulos: ['Fonte_Renda', 'Fonte'], valor: fonteLimpa },
    { rotulos: ['Valor'], valor: valorNum },
    { rotulos: ['Frequência', 'Frequencia'], valor: frequenciaLimpa },
    { rotulos: ['Dia_Recebimento'], valor: String(diaRecebimento) },
    { rotulos: ['Data_Início', 'Data_Inicio'], valor: dataInicio },
    { rotulos: ['Data_Fim'], valor: dataFim },
    { rotulos: ['Status'], valor: 'Ativo' },
  ]);

  await sheets.appendRow(sessao.sid, 'RENDA', linha);
  return { status: 201, body: { ok: true } };
}

module.exports = { criarRenda };
