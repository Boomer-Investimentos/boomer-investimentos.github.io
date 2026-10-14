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

async function registrarNoHistorico({ sid, valoresHistorico, custo, mes, pago }) {
  const header = schema.localizarTabela(valoresHistorico, schema.ROTULOS_HISTORICO).header;
  const ano = Number(mes.slice(0, 4));
  const rotuloMes = schema.MESES_ROTULOS[Number(mes.slice(5, 7)) - 1];
  const registro = schema.parseHistorico(valoresHistorico)[schema.chaveHistorico(custo.custo, ano)];
  const valor = pago ? custo.valor : '';
  const agora = agoraLocal();

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

  const custo = schema.parseCusto(valores).find((c) => c.linhaPlanilha === linha);
  if (!custo) {
    return { status: 404, body: { error: 'Custo não encontrado nessa linha.' } };
  }

  const nomesIguais = escrita.nomesCusto(valores).filter((x) => x.chave === schema.norm(custo.custo));
  if (nomesIguais.length > 1) {
    return {
      status: 409,
      body: { error: `Há mais de um custo chamado "${custo.custo}". Renomeie um deles (ex.: "${escrita.sugerirNomeCusto(valores, custo.custo)}") para registrar o pagamento.` },
    };
  }

  const valoresHistorico = await lerAbaHistorico(sessao.sid);
  if (!valoresHistorico) {
    return { status: 422, body: { error: `A planilha não tem a aba ${ABA_HISTORICO}.` } };
  }

  const pago = statusPagamento === 'Pago';
  await registrarNoHistorico({ sid: sessao.sid, valoresHistorico, custo, mes, pago });

  if (mes === hojeISO().slice(0, 7)) {
    await sheets.updateCell(sessao.sid, a1, statusPagamento);
  }
  return { status: 200, body: { ok: true, linhaPlanilha: linha, statusPagamento, mes } };
}

module.exports = { atualizarPagamento };
