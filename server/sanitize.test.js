const { sanitizeFormulaInjection, sanitizeDeep } = require('./sanitize');

describe('sanitizeFormulaInjection', () => {
  test.each(['=', '+', '-', '@', '\t', '\r'])('neutralizes strings starting with %j', (char) => {
    const input = `${char}HYPERLINK("http://evil.com","click")`;
    expect(sanitizeFormulaInjection(input)).toBe(`'${input}`);
  });

  test('leaves normal strings untouched', () => {
    expect(sanitizeFormulaInjection('João da Silva')).toBe('João da Silva');
    expect(sanitizeFormulaInjection('Aluguel - apto')).toBe('Aluguel - apto');
  });

  test('leaves non-strings untouched', () => {
    expect(sanitizeFormulaInjection(42)).toBe(42);
    expect(sanitizeFormulaInjection(null)).toBe(null);
    expect(sanitizeFormulaInjection(undefined)).toBe(undefined);
  });
});

describe('sanitizeDeep', () => {
  test('sanitizes strings nested in objects and arrays', () => {
    const input = {
      nome: '=cmd|\'/c calc\'!A1',
      endereco: { cidade: '@SUM(1+1)', estado: 'MG' },
      rendas: [{ tipo: '+IMPORTXML("http://evil.com")', valor: 'R$ 1.000,00' }],
    };

    const result = sanitizeDeep(input);

    expect(result.nome).toBe(`'${input.nome}`);
    expect(result.endereco.cidade).toBe(`'${input.endereco.cidade}`);
    expect(result.endereco.estado).toBe('MG');
    expect(result.rendas[0].tipo).toBe(`'${input.rendas[0].tipo}`);
    expect(result.rendas[0].valor).toBe('R$ 1.000,00');
  });

  test('does not mutate the original input', () => {
    const input = { nome: '=malicious' };
    sanitizeDeep(input);
    expect(input.nome).toBe('=malicious');
  });
});
