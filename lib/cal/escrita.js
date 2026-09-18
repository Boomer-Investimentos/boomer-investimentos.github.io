'use strict';

/**
 * Helpers de escrita na planilha: localizar a coluna certa por rótulo (igual
 * à leitura em schema.js, tolerante à ordem real do cabeçalho) e montar a
 * linha/endereço A1 a partir daí. Nunca fala com o Sheets — quem escreve é
 * sheets.js.
 */

const { norm, localizarTabela, ROTULOS_RENDA, ROTULOS_CUSTO } = require('./schema');

/** Índice 0-based -> letra(s) de coluna ("A", "Z", "AA", ...). */
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

/** Índice 0-based da primeira coluna do header (já normalizado) que casa um rótulo. null se nenhuma. */
function indiceColuna(header, ...rotulos) {
  for (const r of rotulos) {
    const idx = header.indexOf(norm(r));
    if (idx >= 0) return idx;
  }
  return null;
}

/** Cabeçalho normalizado da aba CUSTO_FIXO a partir dos valores brutos (values[][]). */
function cabecalhoCusto(valuesDaAba) {
  return localizarTabela(valuesDaAba, ROTULOS_CUSTO).header;
}

/** Cabeçalho normalizado da aba RENDA a partir dos valores brutos (values[][]). */
function cabecalhoRenda(valuesDaAba) {
  return localizarTabela(valuesDaAba, ROTULOS_RENDA).header;
}

/** A1 (ex.: "CUSTO_FIXO!K12") da célula de uma linha já localizada, por rótulo(s) de coluna. */
function enderecoCelula(aba, header, linhaPlanilha, ...rotulos) {
  const idx = indiceColuna(header, ...rotulos);
  if (idx == null) throw new Error(`coluna não encontrada na aba ${aba}: ${rotulos.join('/')}`);
  return `${aba}!${colunaLetra(idx)}${linhaPlanilha}`;
}

/**
 * Monta a linha (array) respeitando a ordem real do cabeçalho.
 * `camposPorRotulos`: [{ rotulos: ['Custo'], valor: 'Aluguel' }, ...].
 * Colunas do header sem campo correspondente saem como ''.
 */
function montarLinha(header, camposPorRotulos) {
  const linha = new Array(header.length).fill('');
  for (const { rotulos, valor } of camposPorRotulos) {
    if (valor === undefined) continue;
    const idx = indiceColuna(header, ...rotulos);
    if (idx != null) linha[idx] = valor;
  }
  return linha;
}

module.exports = {
  colunaLetra,
  indiceColuna,
  cabecalhoCusto,
  cabecalhoRenda,
  enderecoCelula,
  montarLinha,
};
