'use strict';

/**
 * POST /api/cal/pagamento — marca/desmarca o pagamento de um custo num mês.
 * O pagamento fica em HISTORICO_CUSTOS (linha custo+ano, coluna do mês, com o
 * valor pago); Status_Pagamento da CUSTO_FIXO só espelha o mês corrente.
 * Exige sessão (e-mail verificado) — só ter o link do assessor não basta pra
 * escrever, por isso não aceitamos `linkToken` aqui.
 */

const auth = require('../auth');
const sheets = require('../sheets');
const escrita = require('../escrita');
const schema = require('../schema');
const { gerarId } = require('../ids');
const { hojeISO } = require('../dates');

const STATUS_VALIDOS = new Set(['Pago', 'Pendente']);
const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const ABA_HISTORICO = 'HISTORICO_CUSTOS';
const ABA_AUSENTE_RE = /Unable to parse range/i;
const ROTULOS_ULTIMA_ALTERACAO = ['Última alteração', 'Última_Alteração'];

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

async function registrarNoHistorico({ sid, valoresHistorico, custo, mes, pago, nomeUnico }) {
  const header = schema.localizarTabela(valoresHistorico, schema.ROTULOS_HISTORICO).header;
  const ano = Number(mes.slice(0, 4));
  const rotuloMes = schema.MESES_ROTULOS[Number(mes.slice(5, 7)) - 1];
  const hist = schema.parseHistorico(valoresHistorico);
  const valor = pago ? custo.valor : '';
  const agora = agoraLocal();
  const temColunaId = escrita.indiceColuna(header, 'ID') != null;

  // Registro pela identidade do custo: ID quando houver, senão o nome (legado).
  let registro = custo.id
    ? hist[schema.chaveHistorico(custo.id, ano)]
    : hist[schema.chaveHistorico(custo.custo, ano)];

  // Adoção: com ID, herda uma linha antiga por nome (sem ID), só se o nome for
  // único — carimba o ID nela para virar id-keyed daqui pra frente.
  if (!registro && custo.id && temColunaId && nomeUnico) {
    const porNome = hist[schema.chaveHistorico(custo.custo, ano)];
    if (porNome && !porNome.idKeyed) {
      await sheets.updateCell(sid, escrita.enderecoCelula(ABA_HISTORICO, header, porNome.linhaPlanilha, 'ID'), custo.id);
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
  if (!pago) return;
  const linha = escrita.montarLinha(header, [
    { rotulos: ['Custo'], valor: custo.custo },
    { rotulos: ['Ano'], valor: ano },
    { rotulos: [rotuloMes], valor },
    { rotulos: ROTULOS_ULTIMA_ALTERACAO, valor: agora },
    { rotulos: ['ID'], valor: custo.id || '' },
  ]);
  await sheets.appendRow(sid, ABA_HISTORICO, linha);
}

async function atualizarPagamento({ cookies, linhaPlanilha, statusPagamento, mes }) {
  const sessao = auth.lerSessao(cookies);
  if (!sessao) {
    return { status: 401, body: { error: 'Faça login para editar pagamentos.' } };
  }

  const linha = Number(linhaPlanilha);
  if (!Number.isInteger(linha) || linha < 2) {
    return { status: 400, body: { error: 'linhaPlanilha inválida.' } };
  }
  if (!STATUS_VALIDOS.has(statusPagamento)) {
    return { status: 400, body: { error: 'statusPagamento deve ser "Pago" ou "Pendente".' } };
  }
  if (!MES_RE.test(mes || '')) {
    return { status: 400, body: { error: 'Parâmetro "mes" deve ser "YYYY-MM".' } };
  }

  const valores = await sheets.getValues(sessao.sid, 'CUSTO_FIXO!A1:Z2000');
  const header = escrita.cabecalhoCusto(valores);
  let a1;
  try {
    a1 = escrita.enderecoCelula('CUSTO_FIXO', header, linha, 'Status_Pagamento');
  } catch {
    return { status: 500, body: { error: 'Não foi possível localizar a coluna Status_Pagamento.' } };
  }

  const custos = schema.parseCusto(valores);
  const custo = custos.find((c) => c.linhaPlanilha === linha);
  if (!custo) {
    return { status: 404, body: { error: 'Custo não encontrado nessa linha.' } };
  }

  // Garante um ID para a linha (quando a planilha tem a coluna). Com ID, dois
  // custos de mesmo nome deixam de colidir no histórico — por isso não há 409.
  if (!custo.id && escrita.indiceColuna(header, 'ID') != null) {
    const novoId = gerarId(custos.map((c) => c.id).filter(Boolean));
    await sheets.updateCell(sessao.sid, escrita.enderecoCelula('CUSTO_FIXO', header, linha, 'ID'), novoId);
    custo.id = novoId;
  }
  const nomeUnico = custos.filter((c) => schema.norm(c.custo) === schema.norm(custo.custo)).length === 1;

  const valoresHistorico = await lerAbaHistorico(sessao.sid);
  if (!valoresHistorico) {
    return { status: 422, body: { error: `A planilha não tem a aba ${ABA_HISTORICO}.` } };
  }

  const pago = statusPagamento === 'Pago';
  await registrarNoHistorico({ sid: sessao.sid, valoresHistorico, custo, mes, pago, nomeUnico });

  if (mes === hojeISO().slice(0, 7)) {
    await sheets.updateCell(sessao.sid, a1, statusPagamento);
  }
  return { status: 200, body: { ok: true, linhaPlanilha: linha, statusPagamento, mes } };
}

module.exports = { atualizarPagamento };
