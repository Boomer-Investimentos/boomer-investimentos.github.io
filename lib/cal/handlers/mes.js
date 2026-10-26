'use strict';

/**
 * GET /api/cal/mes — devolve a projeção de um mês.
 * Leitura: sessão (cookie) OU o link do assessor (`?s=`) bastam — ver
 * scripts/cal-mint-link.mjs. Escrita (pagamento.js/lancamento.js) exige sessão.
 */

const auth = require('../auth');
const sheets = require('../sheets');
const schema = require('../schema');
const escrita = require('../escrita');
const { gerarId } = require('../ids');
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

/** Lê os valores de uma aba; devolve [] se a aba não existe (planilha antiga). */
async function lerAba(sid, aba) {
  try {
    return (await sheets.getValues(sid, `${aba}!A1:Z2000`)) || [];
  } catch (err) {
    if (err instanceof Error && ABA_AUSENTE_RE.test(err.message)) return [];
    throw err;
  }
}

/** Sem HISTORICO_RESERVAS, nada foi guardado. */
async function lerHistoricoReservas(sid) {
  const valores = await lerAba(sid, 'HISTORICO_RESERVAS');
  return schema.parseHistorico(valores, ['Reserva', 'Nome']);
}

/**
 * Preenche IDs faltantes numa aba (CUSTO_FIXO/RESERVAS) numa só escrita de
 * coluna e reflete nos valores em memória. Só roda com sessão; sem a coluna ID,
 * é no-op. Mutação em memória só após a escrita persistir.
 */
async function backfillIds(sid, aba, values, rotulos, rotuloNome, prefixo) {
  const { header, headerIdx } = schema.localizarTabela(values, rotulos);
  const idxId = escrita.indiceColuna(header, 'ID');
  if (idxId == null) return;
  const rotulosNome = Array.isArray(rotuloNome) ? rotuloNome : [rotuloNome];
  const idxNome = escrita.indiceColuna(header, ...rotulosNome);
  const idxValor = escrita.indiceColuna(header, 'Valor');
  const usados = new Set();
  for (let r = headerIdx + 1; r < values.length; r += 1) {
    const atual = values[r] && values[r][idxId];
    if (atual) usados.add(String(atual).trim());
  }
  const col = [];
  const novos = [];
  for (let r = headerIdx + 1; r < values.length; r += 1) {
    const row = values[r] || [];
    let id = row[idxId] ? String(row[idxId]).trim() : '';
    const nome = idxNome != null ? row[idxNome] : '';
    const valor = idxValor != null ? Number(row[idxValor]) : NaN;
    const ehItem = String(nome == null ? '' : nome).trim() !== '' && Number.isFinite(valor) && valor > 0;
    if (!id && ehItem) {
      id = gerarId(usados, prefixo);
      usados.add(id);
      novos.push({ r, id });
    }
    col.push(id);
  }
  if (!novos.length) return;
  await sheets.updateColumn(sid, aba, escrita.colunaLetra(idxId), headerIdx + 2, col);
  for (const { r, id } of novos) (values[r] = values[r] || [])[idxId] = id;
}

async function obterMes({ cookies, linkToken, mes }) {
  if (!MES_RE.test(mes || '')) {
    return { status: 400, body: { error: 'Parâmetro "mes" deve ser "YYYY-MM".' } };
  }
  const resolvido = resolverSid({ cookies, linkToken });
  if (!resolvido) {
    return { status: 401, body: { error: 'Acesso inválido.' } };
  }

  const [tabs, historico, reservasValues, historicoReservas] = await Promise.all([
    sheets.getTabs(resolvido.sid, ['CONFIG', 'PARAMS', 'RENDA', 'CUSTO_FIXO']),
    lerHistorico(resolvido.sid),
    lerAba(resolvido.sid, 'RESERVAS'),
    lerHistoricoReservas(resolvido.sid),
  ]);
  if (resolvido.autenticado) {
    try {
      await backfillIds(resolvido.sid, 'CUSTO_FIXO', tabs.CUSTO_FIXO, schema.ROTULOS_CUSTO, 'Custo', 'c-');
    } catch (err) {
      console.error('cal/mes backfill ID custo:', err.message);
    }
    try {
      await backfillIds(resolvido.sid, 'RESERVAS', reservasValues, schema.ROTULOS_RESERVA, ['Nome', 'Reserva'], 'r-');
    } catch (err) {
      console.error('cal/mes backfill ID reserva:', err.message);
    }
  }
  const config = schema.parseConfig(tabs.CONFIG);
  const params = schema.parseParams(tabs.PARAMS);
  const renda = schema.parseRenda(tabs.RENDA);
  const custo = schema.parseCusto(tabs.CUSTO_FIXO);
  const reservas = schema.parseReserva(reservasValues);
  const proj = projetarMes({ renda, custo, historico, reservas, historicoReservas, mes });

  return {
    status: 200,
    body: {
      autenticado: resolvido.autenticado,
      cliente: config.cliente,
      moeda: config.moeda,
      tituloEstrategia: params.tituloEstrategia,
      observacaoReserva: params.observacaoReserva,
      nomesCusto: custo.map((c) => c.custo),
      ...proj,
    },
  };
}

module.exports = { obterMes };
