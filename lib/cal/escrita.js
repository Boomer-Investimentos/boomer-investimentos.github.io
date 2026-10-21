'use strict';

const { norm, localizarTabela, dataFimParcelado, ROTULOS_RENDA, ROTULOS_CUSTO } = require('./schema');
const { parseMes, paraBr } = require('./dates');

// Índice 0-based -> letra(s) de coluna ("A", "Z", "AA", ...).
function colunaLetra(idxZeroBased) {
  let n = idxZeroBased + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function indiceColuna(header, ...rotulos) {
  for (const r of rotulos) {
    const idx = header.indexOf(norm(r));
    if (idx >= 0) return idx;
  }
  return null;
}


function cabecalhoCusto(valuesDaAba) {
  return localizarTabela(valuesDaAba, ROTULOS_CUSTO).header;
}


function cabecalhoRenda(valuesDaAba) {
  return localizarTabela(valuesDaAba, ROTULOS_RENDA).header;
}

function enderecoCelula(aba, header, linhaPlanilha, ...rotulos) {
  const idx = indiceColuna(header, ...rotulos);
  if (idx == null) throw new Error(`coluna não encontrada na aba ${aba}: ${rotulos.join('/')}`);
  return `${aba}!${colunaLetra(idx)}${linhaPlanilha}`;
}

function montarLinha(header, camposPorRotulos) {
  const linha = new Array(header.length).fill('');
  for (const { rotulos, valor } of camposPorRotulos) {
    if (valor === undefined) continue;
    const idx = indiceColuna(header, ...rotulos);
    if (idx != null) linha[idx] = valor;
  }
  return linha;
}

/**
 * Mescla campos alterados numa linha EXISTENTE, preservando o resto.
 * Diferente de montarLinha (que monta do zero, certo pra criar — errado pra
 * editar, porque zeraria colunas que o formulário de edição não toca, tipo
 * Observações ou Parcela_Atual).
 */
function mesclarLinha(header, linhaAtual, camposPorRotulos) {
  const linha = [...linhaAtual];
  while (linha.length < header.length) linha.push('');
  for (const { rotulos, valor } of camposPorRotulos) {
    if (valor === undefined) continue;
    const idx = indiceColuna(header, ...rotulos);
    if (idx != null) linha[idx] = valor;
  }
  return linha;
}

/** Nomes (normalizados) de todas as linhas de CUSTO_FIXO, ativas ou não. */
function nomesCusto(valuesDaAba) {
  const { header, linhas } = localizarTabela(valuesDaAba || [], ROTULOS_CUSTO);
  const idx = indiceColuna(header, 'Custo');
  if (idx == null) return [];
  return linhas
    .map(({ valores, linhaPlanilha }) => ({ chave: norm(valores[idx]), linhaPlanilha }))
    .filter((x) => x.chave);
}

function nomeCustoEmUso(valuesDaAba, nome, ignorarLinha) {
  const alvo = norm(nome);
  return nomesCusto(valuesDaAba).some((x) => x.chave === alvo && x.linhaPlanilha !== ignorarLinha);
}

/** Primeiro "Nome 2", "Nome 3"... que ainda não existe. */
function sugerirNomeCusto(valuesDaAba, nome) {
  for (let n = 2; n < 100; n += 1) {
    const candidato = `${nome} ${n}`;
    if (!nomeCustoEmUso(valuesDaAba, candidato)) return candidato;
  }
  return `${nome} 2`;
}

function mensagemNomeRepetido(valuesDaAba, nome) {
  return `Você já adicionou "${nome}". Use outro nome, por exemplo "${sugerirNomeCusto(valuesDaAba, nome)}".`;
}

/**
 * Campos de um custo parcelado a partir do mês em que o usuário está e da
 * parcela em que a compra está nele. O mês de início recua `parcelaAtual - 1`
 * meses (parcela 1 = Data_Início). Devolve { erro } se a entrada for inválida.
 */
function camposParcelado({ parcelas, parcelaAtual, mes }) {
  const total = Number(parcelas);
  if (!Number.isInteger(total) || total < 2 || total > 120) {
    return { erro: 'Parcelas deve ser um número inteiro entre 2 e 120.' };
  }
  const atual = parcelaAtual == null || parcelaAtual === '' ? 1 : Number(parcelaAtual);
  if (!Number.isInteger(atual) || atual < 1 || atual > total) {
    return { erro: 'Parcela atual deve ficar entre 1 e o total de parcelas.' };
  }
  const { ano, mes: m } = parseMes(mes);
  const base = ano * 12 + (m - 1) - (atual - 1);
  const inicio = `${Math.floor(base / 12)}-${String((base % 12) + 1).padStart(2, '0')}-01`;
  return {
    totalParcelas: total,
    dataInicio: paraBr(inicio),
    dataFim: paraBr(dataFimParcelado(inicio, total)),
  };
}

module.exports = {
  colunaLetra,
  nomesCusto,
  nomeCustoEmUso,
  sugerirNomeCusto,
  mensagemNomeRepetido,
  indiceColuna,
  cabecalhoCusto,
  cabecalhoRenda,
  enderecoCelula,
  montarLinha,
  mesclarLinha,
  camposParcelado,
};
