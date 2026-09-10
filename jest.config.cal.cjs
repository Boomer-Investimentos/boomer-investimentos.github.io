/**
 * Jest do backend do Calendário Financeiro (lib/cal + handlers + e2e).
 * Separado do `react-scripts test` (front, jsdom) — aqui é Node puro, CommonJS,
 * sem transform de Babel. Roda com: npm run test:cal
 */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/lib/cal', '<rootDir>/tests/cal'],
  testMatch: ['**/*.test.js'],
  transform: {},
  clearMocks: true,
  collectCoverageFrom: [
    'lib/cal/**/*.js',
    '!lib/cal/**/*.test.js',
    // seams de I/O — exercitados só nos testes manuais/e2e reais
    '!lib/cal/sheets.js',
    '!lib/cal/email.js',
  ],
  coverageThreshold: {
    './lib/cal/projection.js': { lines: 90, functions: 90, branches: 80 },
    './lib/cal/handlers/': { lines: 85, functions: 85, branches: 70 },
  },
};
