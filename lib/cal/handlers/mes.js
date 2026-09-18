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

async function obterMes({ cookies, linkToken, mes }) {
  if (!MES_RE.test(mes || '')) {
    return { status: 400, body: { error: 'Parâmetro "mes" deve ser "YYYY-MM".' } };
  }
  const resolvido = resolverSid({ cookies, linkToken });
  if (!resolvido) {
    return { status: 401, body: { error: 'Acesso inválido. Use o link enviado pelo seu assessor.' } };
  }

  const tabs = await sheets.getTabs(resolvido.sid, ['CONFIG', 'PARAMS', 'RENDA', 'CUSTO_FIXO']);
  const config = schema.parseConfig(tabs.CONFIG);
  const params = schema.parseParams(tabs.PARAMS);
  const renda = schema.parseRenda(tabs.RENDA);
  const custo = schema.parseCusto(tabs.CUSTO_FIXO);
  const proj = projetarMes({ renda, custo, mes });

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
