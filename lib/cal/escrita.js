'use strict';

const { norm, localizarTabela, ROTULOS_RENDA, ROTULOS_CUSTO } = require('./schema');

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

module.exports = {
  colunaLetra,
  indiceColuna,
  cabecalhoCusto,
  cabecalhoRenda,
  enderecoCelula,
  montarLinha,
  mesclarLinha,
};
