'use strict';

/**
 * GET /api/cal/mes — devolve a projeção de um mês.
 * Leitura: sessão (cookie) OU o link do assessor (`?s=`) bastam — ver
 * scripts/cal-mint-link.mjs. Escrita (pagamento.js/lancamento.js) exige sessão.
 */

const auth = require('../auth');
const sheets = require('../sheets');
const schema = require('../schema');
const { projetarMes } = require('../projection');

const MES_RE = /^\d{4}-\d{2}$/;

function resolverSid({ cookies, linkToken }) {
  const sessao = auth.lerSessao(cookies);
  if (sessao) return { sid: sessao.sid, autenticado: true };
  if (linkToken) {
    try {
      return { sid: auth.verificar(linkToken, 'link').sid, autenticado: false };
    } catch {
      return null;
    }
  }
  return null;
}

const ABA_AUSENTE_RE = /Unable to parse range/i;

/** Planilhas antigas podem não ter HISTORICO_CUSTOS: sem a aba, nada foi pago. */
async function lerHistorico(sid) {
  try {
    const tabs = await sheets.getTabs(sid, ['HISTORICO_CUSTOS']);
    return schema.parseHistorico(tabs.HISTORICO_CUSTOS);
  } catch (err) {
    if (err instanceof Error && ABA_AUSENTE_RE.test(err.message)) return {};
    throw err;
  }
}

async function obterMes({ cookies, linkToken, mes }) {
  if (!MES_RE.test(mes || '')) {
    return { status: 400, body: { error: 'Parâmetro "mes" deve ser "YYYY-MM".' } };
  }
  const resolvido = resolverSid({ cookies, linkToken });
  if (!resolvido) {
    return { status: 401, body: { error: 'Acesso inválido.' } };
  }

  const [tabs, historico] = await Promise.all([
    sheets.getTabs(resolvido.sid, ['CONFIG', 'PARAMS', 'RENDA', 'CUSTO_FIXO']),
    lerHistorico(resolvido.sid),
  ]);
  const config = schema.parseConfig(tabs.CONFIG);
  const params = schema.parseParams(tabs.PARAMS);
  const renda = schema.parseRenda(tabs.RENDA);
  const custo = schema.parseCusto(tabs.CUSTO_FIXO);
  const proj = projetarMes({ renda, custo, historico, mes });

  return {
    status: 200,
    body: {
      autenticado: resolvido.autenticado,
      cliente: config.cliente,
      moeda: config.moeda,
      tituloEstrategia: params.tituloEstrategia,
      observacaoReserva: params.observacaoReserva,
      ...proj,
    },
  };
}

module.exports = { obterMes };
