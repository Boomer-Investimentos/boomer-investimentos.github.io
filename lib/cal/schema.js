'use strict';

/**
 * Parsers dos valores brutos da planilha -> objetos normalizados.
 * Tolerante a: cabeçalho deslocado, colunas vazias, células de fórmula
 * (que já vêm calculadas com valueRenderOption=UNFORMATTED_VALUE),
 * linhas parciais/lixo no fim das abas.
 */

const { serialParaData, parseDiaVencimento, ultimoDia, parseMes } = require('./dates');

const COMBINANTES = new RegExp('[\\u0300-\\u036f]', 'g');

function norm(s) {
  return String(s == null ? '' : s)
    .normalize('NFD')
    .replace(COMBINANTES, '')
    .toLowerCase()
    .trim();
}

function ehVazio(v) {
  return v == null || (typeof v === 'string' && v.trim() === '');
}

function num(v) {
  if (ehVazio(v)) return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function texto(v) {
  return ehVazio(v) ? '' : String(v).trim();
}

function ehAtivo(v) {
  const n = norm(v);
  return n === '' || n === 'ativo';
}

/**
 * Acha a linha de cabeçalho (a que mais casa com os rótulos esperados) e
 * devolve { header: string[], linhas: {valores, linhaPlanilha}[] }.
 */
function localizarTabela(values, rotulosEsperados) {
  const alvo = rotulosEsperados.map(norm);
  let melhorIdx = 0;
  let melhorScore = -1;
  const limite = Math.min(values.length, 6);
  for (let i = 0; i < limite; i += 1) {
    const linha = (values[i] || []).map(norm);
    const score = alvo.reduce((acc, r) => acc + (linha.includes(r) ? 1 : 0), 0);
    if (score > melhorScore) {
      melhorScore = score;
      melhorIdx = i;
    }
  }
  const header = (values[melhorIdx] || []).map((h) => norm(h));
  const linhas = [];
  for (let i = melhorIdx + 1; i < values.length; i += 1) {
    linhas.push({ valores: values[i] || [], linhaPlanilha: i + 1 });
  }
  return { header, linhas, headerIdx: melhorIdx };
}

const ROTULOS_RENDA = [
  'Fonte_Renda', 'Valor', 'Frequência', 'Dia_Recebimento', 'Data_Início', 'Data_Fim', 'Status',
];

const ROTULOS_CUSTO = [
  'Custo', 'Valor', 'Categoria', 'Dia_Vencimento', 'Frequência', 'Total_Parcelas',
  'Data_Início', 'Data_Fim', 'Status', 'Status_Pagamento',
];

const ROTULOS_RESERVA = [
  'Reserva', 'Valor', 'Frequência', 'Dia', 'Data_Início', 'Data_Fim', 'Status',
];

function coluna(header, valores, ...nomes) {
  for (const nome of nomes) {
    const idx = header.indexOf(norm(nome));
    if (idx >= 0) return valores[idx];
  }
  return undefined;
}

/** CONFIG / PARAMS: aba chave/valor (col A = parâmetro, col B = valor). */
function parseChaveValor(values) {
  const mapa = {};
  for (const linha of values || []) {
    const chave = norm(linha && linha[0]);
    if (!chave || chave === 'parametro') continue;
    mapa[chave] = linha[1];
  }
  return mapa;
}

function parseConfig(values) {
  const m = parseChaveValor(values);
  return {
    cliente: texto(m.cliente),
    moeda: texto(m.moeda_padrao) || 'BRL',
    emailCliente: norm(m.email_cliente),
    dataReferencia: serialParaData(m.data_referencia),
  };
}

function parseParams(values) {
  const m = parseChaveValor(values);
  return {
    metaInvestimento: texto(m.meta_de_investimento),
    linkCalendario: texto(m.link_calendario),
    tituloEstrategia: texto(m.titulo_estrategia) || 'Estratégia de recebimentos',
    observacaoReserva: texto(m.observacao_reserva),
  };
}

function parseRenda(values) {
  const { header, linhas } = localizarTabela(values, ROTULOS_RENDA);
  const out = [];
  for (const { valores, linhaPlanilha } of linhas) {
    const fonte = texto(coluna(header, valores, 'Fonte_Renda', 'Fonte'));
    const valor = num(coluna(header, valores, 'Valor'));
    if (!fonte || valor == null || valor <= 0) continue;
    out.push({
      fonte,
      valor,
      frequencia: norm(coluna(header, valores, 'Frequência', 'Frequencia')),
      diaRecebimento: coluna(header, valores, 'Dia_Recebimento'),
      dataInicio: serialParaData(coluna(header, valores, 'Data_Início', 'Data_Inicio')),
      dataFim: serialParaData(coluna(header, valores, 'Data_Fim')),
      status: texto(coluna(header, valores, 'Status')),
      ativo: ehAtivo(coluna(header, valores, 'Status')),
      linhaPlanilha,
    });
  }
  return out;
}

/** Data_Fim efetiva de um parcelado: último dia do mês (início + total-1). */
function dataFimParcelado(dataInicioIso, totalParcelas) {
  if (!dataInicioIso || !totalParcelas) return null;
  const { ano, mes } = parseMes(dataInicioIso);
  const base = ano * 12 + (mes - 1) + (totalParcelas - 1);
  const y = Math.floor(base / 12);
  const mo = (base % 12) + 1;
  return ultimoDia(`${y}-${String(mo).padStart(2, '0')}`);
}

function parseCusto(values) {
  const { header, linhas } = localizarTabela(values, ROTULOS_CUSTO);
  const out = [];
  for (const { valores, linhaPlanilha } of linhas) {
    const custo = texto(coluna(header, valores, 'Custo'));
    const valor = num(coluna(header, valores, 'Valor'));
    if (!custo || valor == null || valor <= 0) continue;
    const diaTexto = texto(coluna(header, valores, 'Dia_Vencimento'));
    const totalParcelas = num(coluna(header, valores, 'Total_Parcelas'));
    const dataInicio = serialParaData(coluna(header, valores, 'Data_Início', 'Data_Inicio'));
    let dataFim = serialParaData(coluna(header, valores, 'Data_Fim'));
    if (!dataFim && totalParcelas) dataFim = dataFimParcelado(dataInicio, totalParcelas);
    out.push({
      custo,
      id: texto(coluna(header, valores, 'ID')),
      valor,
      categoria: texto(coluna(header, valores, 'Categoria')),
      diaTexto,
      dia: parseDiaVencimento(diaTexto),
      frequencia: norm(coluna(header, valores, 'Frequência', 'Frequencia')) || 'mensal',
      totalParcelas: totalParcelas || null,
      dataInicio,
      dataFim,
      status: texto(coluna(header, valores, 'Status')),
      ativo: ehAtivo(coluna(header, valores, 'Status')),
      statusPagamento: texto(coluna(header, valores, 'Status_Pagamento')) || 'Pendente',
      linhaPlanilha,
    });
  }
  return out;
}

/**
 * RESERVAS: aba de regras de reserva. Formato enxuto, no estilo da RENDA
 * (sem categoria/parcelas/pagamento). O "guardado por mês" vive no
 * HISTORICO_RESERVAS, não aqui. ID (quando a coluna existe) é a chave estável
 * p/ casar com o histórico, igual ao custo.
 */
function parseReserva(values) {
  const { header, linhas } = localizarTabela(values, ROTULOS_RESERVA);
  const out = [];
  for (const { valores, linhaPlanilha } of linhas) {
    const nome = texto(coluna(header, valores, 'Reserva'));
    const valor = num(coluna(header, valores, 'Valor'));
    if (!nome || valor == null || valor <= 0) continue;
    const diaTexto = texto(coluna(header, valores, 'Dia', 'Dia_Reserva'));
    out.push({
      nome,
      id: texto(coluna(header, valores, 'ID')),
      valor,
      diaTexto,
      dia: parseDiaVencimento(diaTexto),
      frequencia: norm(coluna(header, valores, 'Frequência', 'Frequencia')) || 'mensal',
      dataInicio: serialParaData(coluna(header, valores, 'Data_Início', 'Data_Inicio')),
      dataFim: serialParaData(coluna(header, valores, 'Data_Fim')),
      status: texto(coluna(header, valores, 'Status')),
      ativo: ehAtivo(coluna(header, valores, 'Status')),
      linhaPlanilha,
    });
  }
  return out;
}

const MESES_ROTULOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const ROTULOS_HISTORICO = ['Custo', 'Ano', ...MESES_ROTULOS];

const ROTULOS_HISTORICO_RESERVAS = ['Reserva', 'Ano', ...MESES_ROTULOS];

/** Chave do HISTORICO_CUSTOS. `chave` é o ID do custo (quando houver) ou o nome;
 * norm é idempotente sobre um ID (`c-...`), então os dois casos convivem. */
function chaveHistorico(chave, ano) {
  return `${norm(chave)}|${ano}`;
}

/** Identidade do custo p/ casar com o histórico: ID se houver, senão o nome. */
function chaveCusto(c) {
  return c && c.id ? c.id : norm(c && c.custo);
}

function parseHistorico(values, rotuloNome = 'Custo') {
  const rotulos = [rotuloNome, 'Ano', ...MESES_ROTULOS];
  const { header, linhas } = localizarTabela(values || [], rotulos);
  const out = {};
  for (const { valores, linhaPlanilha } of linhas) {
    const custo = texto(coluna(header, valores, rotuloNome));
    const ano = num(coluna(header, valores, 'Ano'));
    if (!custo || ano == null) continue;
    const id = texto(coluna(header, valores, 'ID'));
    const chave = chaveHistorico(id || custo, ano);
    const reg = out[chave] || { linhaPlanilha, meses: {}, custo, id, idKeyed: !!id };
    MESES_ROTULOS.forEach((rotulo, i) => {
      const v = num(coluna(header, valores, rotulo));
      if (v != null && v > 0) reg.meses[i + 1] = v;
    });
    out[chave] = reg;
  }
  return out;
}

function parseEstrategia(values) {
  const { header, linhas } = localizarTabela(values, ['Ordem', 'Item']);
  const itens = [];
  for (const { valores } of linhas) {
    const item = texto(coluna(header, valores, 'Item'));
    if (!item) continue;
    const ordem = num(coluna(header, valores, 'Ordem'));
    itens.push({ ordem: ordem == null ? itens.length + 1 : ordem, item });
  }
  itens.sort((a, b) => a.ordem - b.ordem);
  return itens.map((x) => x.item);
}

module.exports = {
  parseConfig,
  parseParams,
  parseRenda,
  parseCusto,
  parseReserva,
  parseHistorico,
  chaveHistorico,
  chaveCusto,
  parseEstrategia,
  dataFimParcelado,
  norm,
  localizarTabela,
  ROTULOS_RENDA,
  ROTULOS_CUSTO,
  ROTULOS_RESERVA,
  ROTULOS_HISTORICO,
  ROTULOS_HISTORICO_RESERVAS,
  MESES_ROTULOS,
};
