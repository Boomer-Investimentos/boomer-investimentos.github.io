'use strict';

const d = require('./dates');

describe('serialParaData / dataParaSerial', () => {
  test('serial do Excel vira YYYY-MM-DD (dados 2026)', () => {
    expect(d.serialParaData(46266)).toBe('2026-09-01');
    expect(d.serialParaData(46273)).toBe('2026-09-08');
    expect(d.serialParaData(46235)).toBe('2026-08-01');
  });

  test('ida e volta', () => {
    expect(d.dataParaSerial('2026-09-01')).toBe(46266);
    expect(d.dataParaSerial(d.serialParaData(46000))).toBe(46000);
  });

  test('aceita string ISO ou BR e ignora vazio', () => {
    expect(d.serialParaData('2026-09-01')).toBe('2026-09-01');
    expect(d.serialParaData('01/09/2026')).toBe('2026-09-01');
    expect(d.serialParaData('')).toBeNull();
    expect(d.serialParaData(null)).toBeNull();
  });
});

describe('diasNoMes', () => {
  test('fevereiro comum e bissexto', () => {
    expect(d.diasNoMes('2026-02')).toBe(28);
    expect(d.diasNoMes('2028-02')).toBe(29);
    expect(d.diasNoMes('2026-09')).toBe(30);
    expect(d.diasNoMes('2026-01')).toBe(31);
  });
});

describe('clampDia', () => {
  test('limita ao fim do mês e piso 1', () => {
    expect(d.clampDia(31, '2026-09')).toBe(30);
    expect(d.clampDia(15, '2026-09')).toBe(15);
    expect(d.clampDia(0, '2026-09')).toBe(1);
    expect(d.clampDia('', '2026-09')).toBe(1);
  });
});

describe('ocorrenciasDeDiaDaSemana', () => {
  test('sextas de setembro/2026', () => {
    expect(d.ocorrenciasDeDiaDaSemana('2026-09', 'Sexta-Feira')).toEqual([4, 11, 18, 25]);
  });
  test('tolera variações de escrita', () => {
    expect(d.ocorrenciasDeDiaDaSemana('2026-09', 'sexta')).toEqual([4, 11, 18, 25]);
    expect(d.ocorrenciasDeDiaDaSemana('2026-09', 'SÁBADO')).toEqual([5, 12, 19, 26]);
    expect(d.ocorrenciasDeDiaDaSemana('2026-09', 'Segunda-feira')).toEqual([7, 14, 21, 28]);
  });
  test('nome inválido -> []', () => {
    expect(d.ocorrenciasDeDiaDaSemana('2026-09', 'qualquer')).toEqual([]);
    expect(d.ocorrenciasDeDiaDaSemana('2026-09', '')).toEqual([]);
  });
});

describe('mesesEntre', () => {
  test('conta meses B - A', () => {
    expect(d.mesesEntre('2026-09-01', '2026-12-01')).toBe(3);
    expect(d.mesesEntre('2026-09', '2027-03')).toBe(6);
    expect(d.mesesEntre('2026-09', '2026-09')).toBe(0);
    expect(d.mesesEntre('2026-12', '2026-09')).toBe(-3);
  });
});

describe('parseDiaVencimento', () => {
  test('extrai o primeiro dia válido de texto livre', () => {
    expect(d.parseDiaVencimento('1 a 5')).toBe(1);
    expect(d.parseDiaVencimento('18')).toBe(18);
    expect(d.parseDiaVencimento('15 e 30')).toBe(15);
    expect(d.parseDiaVencimento('4 PARCELA DE 4')).toBe(4);
  });
  test('sem dia -> null', () => {
    expect(d.parseDiaVencimento('NÃO TEM JUROS, DÍVIDA CONGELADA')).toBeNull();
    expect(d.parseDiaVencimento('')).toBeNull();
    expect(d.parseDiaVencimento(null)).toBeNull();
  });
});

describe('hoje (America/Sao_Paulo)', () => {
  test('usa o fuso de SP, não UTC', () => {
    // 2026-09-10 00:30 UTC ainda é 2026-09-09 em São Paulo (UTC-3)
    const meiaNoiteUtc = new Date('2026-09-10T00:30:00Z');
    expect(d.hojeISO(meiaNoiteUtc)).toBe('2026-09-09');
    expect(d.mesAtual(meiaNoiteUtc)).toBe('2026-09');
    expect(d.hojeSerial(meiaNoiteUtc)).toBe(d.dataParaSerial('2026-09-09'));
  });
});
