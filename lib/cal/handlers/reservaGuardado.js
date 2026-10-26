'use strict';

/**
 * POST /api/cal/reserva-guardado — marca/desmarca o quanto foi guardado numa
 * reserva num mês. Fica em HISTORICO_RESERVAS (linha reserva+ano, coluna do
 * mês, com o valor guardado), igual ao HISTORICO_CUSTOS do custo. A aba
 * RESERVAS não guarda estado por mês. Exige sessão (e-mail verificado).
 */

const auth = require('../auth');
const sheets = require('../sheets');
const escrita = require('../escrita');
const schema = require('../schema');
const { gerarId } = require('../ids');

const STATUS_VALIDOS = new Set(['Guardado', 'Pendente']);
const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const ABA_HISTORICO = 'HISTORICO_RESERVAS';
const ABA_AUSENTE_RE = /Unable to parse range/i;
const ROTULOS_ULTIMA_ALTERACAO = ['Última alteração', 'Última_Alteração'];
const HEADER_HISTORICO_RESERVAS_NOVO = ['Nome', 'Ano', ...schema.MESES_ROTULOS, 'ID', 'Última alteração'];

async function lerAbaHistorico(sid) {
  try {
    return await sheets.getValues(sid, `${ABA_HISTORICO}!A1:Z2000`);
  } catch (err) {
    if (err instanceof Error && ABA_AUSENTE_RE.test(err.message)) return null;
    throw err;
  }
}

function agoraLocal() {
  return new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

async function registrarNoHistorico({ sid, valoresHistorico, reserva, mes, guardado, nomeUnico }) {
  const tabela = schema.localizarTabela(valoresHistorico, schema.ROTULOS_HISTORICO_RESERVAS);
  let header = tabela.header;
  // Aba criada sem cabeçalho: não há nada pra ler. Se for pra guardar, monta
  // o cabeçalho padrão antes de gravar a primeira linha; se for pra limpar,
  // não há o que fazer.
  if (tabela.score <= 0) {
    if (!guardado) return;
    await sheets.appendRow(sid, ABA_HISTORICO, HEADER_HISTORICO_RESERVAS_NOVO);
    header = HEADER_HISTORICO_RESERVAS_NOVO.map(schema.norm);
  }
  const ano = Number(mes.slice(0, 4));
  const rotuloMes = schema.MESES_ROTULOS[Number(mes.slice(5, 7)) - 1];
  const hist = schema.parseHistorico(valoresHistorico, ['Reserva', 'Nome']);
  const valor = guardado ? reserva.valor : '';
  const agora = agoraLocal();
  // Só chaveia por ID quando a aba de histórico tem a coluna ID; senão cai no
  // legado por nome (ex.: RESERVAS já migrada, HISTORICO ainda não).
  const usarId = reserva.id && escrita.indiceColuna(header, 'ID') != null;

  let registro = usarId
    ? hist[schema.chaveHistorico(reserva.id, ano)]
    : hist[schema.chaveHistorico(reserva.nome, ano)];

  // Adoção: com ID, herda uma linha antiga por nome (sem ID), só se o nome for
  // único — carimba o ID nela para virar id-keyed daqui pra frente.
  if (!registro && usarId && nomeUnico) {
    const porNome = hist[schema.chaveHistorico(reserva.nome, ano)];
    if (porNome && !porNome.idKeyed) {
      await sheets.updateCell(sid, escrita.enderecoCelula(ABA_HISTORICO, header, porNome.linhaPlanilha, 'ID'), reserva.id);
      registro = porNome;
    }
  }

  if (registro) {
    await sheets.updateCell(sid, escrita.enderecoCelula(ABA_HISTORICO, header, registro.linhaPlanilha, rotuloMes), valor);
    if (escrita.indiceColuna(header, ...ROTULOS_ULTIMA_ALTERACAO) != null) {
      const a1 = escrita.enderecoCelula(ABA_HISTORICO, header, registro.linhaPlanilha, ...ROTULOS_ULTIMA_ALTERACAO);
      await sheets.updateCell(sid, a1, agora);
    }
    return;
  }
  if (!guardado) return;
  const linha = escrita.montarLinha(header, [
    { rotulos: ['Reserva', 'Nome'], valor: reserva.nome },
    { rotulos: ['Ano'], valor: ano },
    { rotulos: [rotuloMes], valor },
    { rotulos: ROTULOS_ULTIMA_ALTERACAO, valor: agora },
    { rotulos: ['ID'], valor: reserva.id || '' },
  ]);
  await sheets.appendRow(sid, ABA_HISTORICO, linha);
}

async function atualizarReserva({ cookies, linhaPlanilha, statusReserva, mes }) {
  const sessao = auth.lerSessao(cookies);
  if (!sessao) {
    return { status: 401, body: { error: 'Faça login para editar reservas.' } };
  }

  const linha = Number(linhaPlanilha);
  if (!Number.isInteger(linha) || linha < 2) {
    return { status: 400, body: { error: 'linhaPlanilha inválida.' } };
  }
  if (!STATUS_VALIDOS.has(statusReserva)) {
    return { status: 400, body: { error: 'statusReserva deve ser "Guardado" ou "Pendente".' } };
  }
  if (!MES_RE.test(mes || '')) {
    return { status: 400, body: { error: 'Parâmetro "mes" deve ser "YYYY-MM".' } };
  }

  const valores = await sheets.getValues(sessao.sid, 'RESERVAS!A1:Z2000');
  const header = escrita.cabecalhoReserva(valores);
  const reservas = schema.parseReserva(valores);
  const reserva = reservas.find((r) => r.linhaPlanilha === linha);
  if (!reserva) {
    return { status: 404, body: { error: 'Reserva não encontrada nessa linha.' } };
  }

  // Garante um ID para a linha (quando a planilha tem a coluna). Com ID, duas
  // reservas de mesmo nome deixam de colidir no histórico.
  if (!reserva.id && escrita.indiceColuna(header, 'ID') != null) {
    const novoId = gerarId(reservas.map((r) => r.id).filter(Boolean), 'r-');
    await sheets.updateCell(sessao.sid, escrita.enderecoCelula('RESERVAS', header, linha, 'ID'), novoId);
    reserva.id = novoId;
  }
  const nomeUnico = reservas.filter((r) => schema.norm(r.nome) === schema.norm(reserva.nome)).length === 1;

  const valoresHistorico = await lerAbaHistorico(sessao.sid);
  if (!valoresHistorico) {
    return { status: 422, body: { error: `A planilha não tem a aba ${ABA_HISTORICO}.` } };
  }

  const guardado = statusReserva === 'Guardado';
  await registrarNoHistorico({ sid: sessao.sid, valoresHistorico, reserva, mes, guardado, nomeUnico });

  return { status: 200, body: { ok: true, linhaPlanilha: linha, statusReserva, mes } };
}

module.exports = { atualizarReserva };
