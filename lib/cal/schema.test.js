'use strict';

const s = require('./schema');
const fx = require('../../tests/cal/fixtures/planilha');

describe('parseConfig', () => {
  test('extrai cliente, moeda, e-mail e data de referência', () => {
    expect(s.parseConfig(fx.SHEETS.CONFIG)).toEqual({
      cliente: 'Cliente Exemplo',
      moeda: 'USD',
      emailCliente: 'cliente@exemplo.com',
      dataReferencia: '2026-09-08',
    });
  });

  test('sem Moeda_Padrão cai em BRL', () => {
    expect(s.parseConfig([['Cliente', 'Fulano']]).moeda).toBe('BRL');
  });
});

describe('parseParams', () => {
  test('título/observação/link', () => {
    const p = s.parseParams(fx.SHEETS.PARAMS);
    expect(p.tituloEstrategia).toBe('Estratégia de recebimentos');
    expect(p.observacaoReserva).toBe('Acompanhar recibos manualmente');
    expect(p.linkCalendario).toContain('script.google.com');
  });

  test('default de título quando ausente', () => {
    expect(s.parseParams([]).tituloEstrategia).toBe('Estratégia de recebimentos');
  });
});

describe('parseRenda', () => {
  test('linha semanal normalizada', () => {
    const r = s.parseRenda(fx.SHEETS.RENDA);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      fonte: 'Salário',
      valor: 800,
      frequencia: 'semanal',
      diaRecebimento: 'Sexta-Feira',
      ativo: true,
    });
  });
});

describe('parseCusto', () => {
  const custos = s.parseCusto(fx.SHEETS.CUSTO_FIXO);
  const por = (nome) => custos.find((c) => c.custo === nome);

  test('ignora linhas em branco, parciais e "teste"', () => {
    expect(custos).toHaveLength(10);
    expect(por('teste')).toBeUndefined();
  });

  test('Dia_Vencimento em texto livre', () => {
    expect(por('Aluguel').dia).toBe(1); // "1 a 5"
    expect(por('Terapia').dia).toBe(15); // "15 e 30"
    expect(por('Celular').dia).toBeNull(); // vazio
    expect(por('Dívida congelada').dia).toBeNull(); // "NÃO TEM JUROS..."
  });

  test('parcelado: Data_Fim por fórmula (EOMONTH início + total-1)', () => {
    const p = por('Compra parcelada A');
    expect(p.totalParcelas).toBe(4);
    expect(p.dataInicio).toBe('2026-09-01');
    expect(p.dataFim).toBe('2026-12-31');
  });

  test('linha inativa marcada como ativo:false', () => {
    expect(por('Serviço antigo').ativo).toBe(false);
  });

  test('guarda o número da linha na planilha (para marcar pago)', () => {
    // cabeçalho na linha 1, Aluguel na linha 2 (1-indexado)
    expect(por('Aluguel').linhaPlanilha).toBe(2);
    expect(por('Internet').linhaPlanilha).toBe(8);
  });
});

describe('cabeçalho deslocado', () => {
  test('acha a tabela mesmo com linha de aviso antes do cabeçalho', () => {
    const deslocado = [['AVISO: aba legada, não editar'], ...fx.SHEETS.CUSTO_FIXO];
    const custos = s.parseCusto(deslocado);
    expect(custos.find((c) => c.custo === 'Aluguel')).toBeDefined();
    expect(custos).toHaveLength(10);
  });
});

describe('parseEstrategia', () => {
  test('ordena por Ordem e devolve só os textos', () => {
    expect(s.parseEstrategia(fx.SHEETS.ESTRATEGIA)).toEqual([
      '1º recebimento: separar parte para investimento',
      '2º recebimento: usar normalmente',
      '3º recebimento: separar para contas',
      '4º recebimento: guardar para o aluguel',
    ]);
  });

  test('fora de ordem ainda sai ordenado', () => {
    const baguncado = [
      ['Ordem', 'Item'],
      [2, 'b'],
      [1, 'a'],
      [3, 'c'],
    ];
    expect(s.parseEstrategia(baguncado)).toEqual(['a', 'b', 'c']);
  });
});
