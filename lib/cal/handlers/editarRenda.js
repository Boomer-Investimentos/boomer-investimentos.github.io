'use strict';

const auth = require('../auth');
const sheets = require('../sheets');
const escrita = require('../escrita');
const { ultimoDia, paraBr, diaRecebimentoValido, frequenciaCanonica } = require('../dates');

const STATUS_VALIDOS = new Set(['Ativo', 'Inativo']);

async function editarRenda({ cookies, linhaPlanilha, fonte, valor, frequencia, diaRecebimento, mes, repetirTodoMes, status }) {
  const sessao = auth.lerSessao(cookies);
  if (!sessao) {
    return { status: 401, body: { error: 'Faça login para editar renda.' } };
  }

  const linha = Number(linhaPlanilha);
  if (!Number.isInteger(linha) || linha < 2) {
    return { status: 400, body: { error: 'linhaPlanilha inválida.' } };
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
  if (status !== undefined && !STATUS_VALIDOS.has(status)) {
    return { status: 400, body: { error: 'status deve ser "Ativo" ou "Inativo".' } };
  }

  const valores = await sheets.getValues(sessao.sid, 'RENDA!A1:Z2000');
  const header = escrita.cabecalhoRenda(valores);
  const linhaAtual = valores[linha - 1];
  if (!linhaAtual) {
    return { status: 404, body: { error: 'Linha não encontrada.' } };
  }

  const linhaEditada = escrita.mesclarLinha(header, linhaAtual, [
    { rotulos: ['Fonte_Renda', 'Fonte'], valor: fonteLimpa },
    { rotulos: ['Valor'], valor: valorNum },
    { rotulos: ['Frequência', 'Frequencia'], valor: frequenciaLimpa },
    { rotulos: ['Dia_Recebimento'], valor: String(diaRecebimento) },
    { rotulos: ['Data_Fim'], valor: repetirTodoMes ? '' : paraBr(ultimoDia(mes)) },
    { rotulos: ['Status'], valor: status },
  ]);

  await sheets.updateRow(sessao.sid, 'RENDA', linha, linhaEditada);
  return { status: 200, body: { ok: true } };
}

module.exports = { editarRenda };
