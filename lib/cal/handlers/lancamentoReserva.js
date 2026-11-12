'use strict';

const auth = require('../auth');
const sheets = require('../sheets');
const escrita = require('../escrita');
const schema = require('../schema');
const { gerarId } = require('../ids');
const { atualizarReserva } = require('./reservaGuardado');
const { primeiroDia, ultimoDia, paraBr, diasNoMes, frequenciaCanonica } = require('../dates');

const FREQ_VALIDAS = new Set(['Mensal', 'Única']);
const AVISO_GUARDADO_NAO_MARCADO = 'A reserva foi criada, mas não deu para marcá-la como reservada. Marque-a na lista.';

/**
 * Marca a reserva recém-criada como guardada em `mes` (via atualizarReserva, que
 * mexe no HISTORICO_RESERVAS). Acha a linha nova pelo ID — ou, sem coluna ID,
 * pela última linha com esse nome. Devolve um aviso se não conseguiu; a reserva
 * já existe nesse ponto, então nunca falha a criação.
 */
async function marcarComoGuardada({ cookies, sid, nome, id, mes }) {
  try {
    const reservas = schema.parseReserva(await sheets.getValues(sid, 'RESERVAS!A1:Z2000'));
    const alvo = id
      ? reservas.find((r) => r.id === id)
      : [...reservas].reverse().find((r) => schema.norm(r.nome) === schema.norm(nome));
    if (!alvo) return AVISO_GUARDADO_NAO_MARCADO;
    const r = await atualizarReserva({ cookies, linhaPlanilha: alvo.linhaPlanilha, id: alvo.id || '', statusReserva: 'Guardado', mes });
    return r.status === 200 ? null : AVISO_GUARDADO_NAO_MARCADO;
  } catch (err) {
    if (!(err instanceof Error)) throw err;
    console.error('cal/reserva marcarComoGuardada error:', err.message);
    return AVISO_GUARDADO_NAO_MARCADO;
  }
}

async function criarReserva({ cookies, nome, valor, dia, frequencia, mes, repetirTodoMes = true, dataInicio: dataInicioMes, statusReserva }) {
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

  const mesInicio = /^\d{4}-\d{2}$/.test(dataInicioMes || '') ? dataInicioMes : mes;
  const dataInicio = paraBr(primeiroDia(mesInicio));
  const dataFim = repetirTodoMes ? '' : paraBr(ultimoDia(mesInicio));

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
  let novoId = '';
  if (escrita.indiceColuna(header, 'ID') != null) {
    novoId = gerarId(schema.parseReserva(valores).map((r) => r.id).filter(Boolean), 'r-');
    campos.push({ rotulos: ['ID'], valor: novoId });
  }
  const linha = escrita.montarLinha(header, campos);

  await sheets.appendRow(sessao.sid, 'RESERVAS', linha);

  // Já nasce guardada: o mês marcado é o da 1ª ocorrência.
  if (statusReserva === 'Guardado') {
    const aviso = await marcarComoGuardada({ cookies, sid: sessao.sid, nome: nomeLimpo, id: novoId, mes: mesInicio });
    if (aviso) return { status: 201, body: { ok: true, aviso } };
  }
  return { status: 201, body: { ok: true } };
}

module.exports = { criarReserva };
