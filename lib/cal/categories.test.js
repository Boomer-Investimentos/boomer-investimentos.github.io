'use strict';

const { categoria, todas, OUTROS } = require('./categories');

test('categorias conhecidas resolvem com ícone e cor', () => {
  expect(categoria('Moradia')).toMatchObject({ nome: 'Moradia', icone: '🏠' });
  expect(categoria('Recebimento').icone).toBe('🪙');
  expect(categoria('Compras').icone).toBe('🛍️');
});

test('tolera acento, caixa e espaços', () => {
  expect(categoria('saude').nome).toBe('Saúde');
  expect(categoria('  ENTRETENIMENTO ').nome).toBe('Entretenimento');
  expect(categoria('Software e Ferramentas').nome).toBe('Software e Ferramentas');
});

test('desconhecida ou vazia -> Outros', () => {
  expect(categoria('Xpto')).toEqual(OUTROS);
  expect(categoria('')).toEqual(OUTROS);
  expect(categoria(null)).toEqual(OUTROS);
  expect(categoria(undefined)).toEqual(OUTROS);
});

test('todas() inclui Outros por último e é imutável por cópia', () => {
  const lista = todas();
  expect(lista[lista.length - 1].nome).toBe('Outros');
  lista[0].cor = '#000';
  expect(categoria('Recebimento').cor).not.toBe('#000');
});
