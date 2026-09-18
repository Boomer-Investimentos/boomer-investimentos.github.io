'use strict';

const e = require('./escrita');
const fx = require('../../tests/cal/fixtures/planilha');

describe('colunaLetra', () => {
  test('primeiras colunas', () => {
    expect(e.colunaLetra(0)).toBe('A');
    expect(e.colunaLetra(25)).toBe('Z');
    expect(e.colunaLetra(26)).toBe('AA');
    expect(e.colunaLetra(27)).toBe('AB');
    expect(e.colunaLetra(51)).toBe('AZ');
  });
});

describe('cabecalhoCusto / indiceColuna', () => {
  const header = e.cabecalhoCusto(fx.SHEETS.CUSTO_FIXO);

  test('acha Status_Pagamento e Custo tolerando acento/caixa', () => {
    expect(e.indiceColuna(header, 'Status_Pagamento')).toBe(header.indexOf('status_pagamento'));
    expect(e.indiceColuna(header, 'custo')).toBe(0);
  });

  test('rótulo inexistente devolve null', () => {
    expect(e.indiceColuna(header, 'coluna_que_nao_existe')).toBeNull();
  });
});

describe('enderecoCelula', () => {
  const header = e.cabecalhoCusto(fx.SHEETS.CUSTO_FIXO);

  test('monta A1 da coluna Status_Pagamento na linha do Aluguel (linha 2)', () => {
    const idx = header.indexOf('status_pagamento');
    expect(e.enderecoCelula('CUSTO_FIXO', header, 2, 'Status_Pagamento')).toBe(
      `CUSTO_FIXO!${e.colunaLetra(idx)}2`
    );
  });

  test('lança se a coluna não existir', () => {
    expect(() => e.enderecoCelula('CUSTO_FIXO', header, 2, 'coluna_fantasma')).toThrow();
  });
});

describe('montarLinha', () => {
  test('respeita a ordem real do cabeçalho e deixa "" onde não há campo', () => {
    const header = e.cabecalhoCusto(fx.SHEETS.CUSTO_FIXO);
    const linha = e.montarLinha(header, [
      { rotulos: ['Custo'], valor: 'Nova assinatura' },
      { rotulos: ['Valor'], valor: 29.9 },
      { rotulos: ['Categoria'], valor: 'Entretenimento' },
      { rotulos: ['Status'], valor: 'Ativo' },
      { rotulos: ['Status_Pagamento'], valor: 'Pendente' },
    ]);
    expect(linha).toHaveLength(header.length);
    expect(linha[header.indexOf('custo')]).toBe('Nova assinatura');
    expect(linha[header.indexOf('valor')]).toBe(29.9);
    expect(linha[header.indexOf('categoria')]).toBe('Entretenimento');
    expect(linha[header.indexOf('dia_vencimento')]).toBe('');
    expect(linha[header.indexOf('status_pagamento')]).toBe('Pendente');
  });

  test('cabeçalho em outra ordem ainda posiciona certo', () => {
    const headerEmbaralhado = ['status_pagamento', 'custo', 'valor'];
    const linha = e.montarLinha(headerEmbaralhado, [
      { rotulos: ['Custo'], valor: 'X' },
      { rotulos: ['Valor'], valor: 10 },
      { rotulos: ['Status_Pagamento'], valor: 'Pago' },
    ]);
    expect(linha).toEqual(['Pago', 'X', 10]);
  });
});
