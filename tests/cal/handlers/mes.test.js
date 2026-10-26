'use strict';

process.env.CAL_JWT_SECRET = 'segredo-de-teste-bem-comprido-1234';

jest.mock('../../../lib/cal/sheets');

const sheets = require('../../../lib/cal/sheets');
const auth = require('../../../lib/cal/auth');
const fx = require('../fixtures/planilha');
const { obterMes } = require('../../../lib/cal/handlers/mes');

beforeEach(() => {
  sheets.getTabs.mockResolvedValue({
    CONFIG: fx.SHEETS.CONFIG,
    PARAMS: fx.SHEETS.PARAMS,
    RENDA: fx.SHEETS.RENDA,
    CUSTO_FIXO: fx.SHEETS.CUSTO_FIXO,
  });
});

describe('obterMes — HISTORICO_CUSTOS', () => {
  const link = () => auth.assinarLink(fx.SPREADSHEET_ID);
  const base = {
    CONFIG: fx.SHEETS.CONFIG, PARAMS: fx.SHEETS.PARAMS, RENDA: fx.SHEETS.RENDA, CUSTO_FIXO: fx.SHEETS.CUSTO_FIXO,
  };

  test('valor do mês no histórico marca o custo como pago só naquele mês', async () => {
    sheets.getTabs.mockImplementation(async (_sid, tabs) => (
      tabs[0] === 'HISTORICO_CUSTOS' ? { HISTORICO_CUSTOS: fx.SHEETS.HISTORICO_CUSTOS } : base
    ));
    const set = await obterMes({ cookies: {}, linkToken: link(), mes: '2026-09' });
    const out = await obterMes({ cookies: {}, linkToken: link(), mes: '2026-10' });
    const aluguel = (r) => r.body.dias.flatMap((d) => d.itens).find((i) => i.nome === 'Aluguel');
    expect(aluguel(set)).toMatchObject({ statusPagamento: 'pago' });
    expect(aluguel(out)).toMatchObject({ statusPagamento: 'pendente' });
  });

  test('planilha sem a aba HISTORICO_CUSTOS segue funcionando (nada pago)', async () => {
    sheets.getTabs.mockImplementation(async (_sid, tabs) => {
      if (tabs[0] === 'HISTORICO_CUSTOS') throw new Error('Unable to parse range: HISTORICO_CUSTOS!A1:Z2000');
      return base;
    });
    const r = await obterMes({ cookies: {}, linkToken: link(), mes: '2026-09' });
    expect(r.status).toBe(200);
    expect(r.body.totals.pago).toBe(0);
  });
});

describe('obterMes', () => {
  test('mes fora do formato YYYY-MM -> 400', async () => {
    const r = await obterMes({ cookies: {}, linkToken: null, mes: '09-2026' });
    expect(r.status).toBe(400);
  });

  test('sem cookie de sessão e sem link -> 401', async () => {
    const r = await obterMes({ cookies: {}, linkToken: null, mes: '2026-09' });
    expect(r.status).toBe(401);
    expect(sheets.getTabs).not.toHaveBeenCalled();
  });

  test('link token inválido -> 401', async () => {
    const r = await obterMes({ cookies: {}, linkToken: 'lixo', mes: '2026-09' });
    expect(r.status).toBe(401);
  });

  test('link válido dá acesso de leitura (autenticado:false)', async () => {
    const link = auth.assinarLink(fx.SPREADSHEET_ID);
    const r = await obterMes({ cookies: {}, linkToken: link, mes: '2026-09' });
    expect(r.status).toBe(200);
    expect(r.body.autenticado).toBe(false);
    expect(r.body.cliente).toBe('Cliente Exemplo');
    expect(r.body.dias).toHaveLength(30);
    expect(sheets.getTabs).toHaveBeenCalledWith(fx.SPREADSHEET_ID, ['CONFIG', 'PARAMS', 'RENDA', 'CUSTO_FIXO']);
  });

  test('sessão válida dá acesso (autenticado:true), sem precisar de link', async () => {
    const token = auth.assinarSessao({ sid: fx.SPREADSHEET_ID, email: fx.EMAIL });
    const r = await obterMes({ cookies: { [auth.COOKIE_NOME]: token }, linkToken: null, mes: '2026-09' });
    expect(r.status).toBe(200);
    expect(r.body.autenticado).toBe(true);
  });

  test('sessão tem prioridade sobre link', async () => {
    const token = auth.assinarSessao({ sid: fx.SPREADSHEET_ID, email: fx.EMAIL });
    const r = await obterMes({ cookies: { [auth.COOKIE_NOME]: token }, linkToken: 'qualquer-coisa-invalida', mes: '2026-09' });
    expect(r.status).toBe(200);
    expect(r.body.autenticado).toBe(true);
  });
});

describe('obterMes — backfill de ID', () => {
  const sessao = { [auth.COOKIE_NOME]: auth.assinarSessao({ sid: fx.SPREADSHEET_ID, email: fx.EMAIL }) };
  const link = () => auth.assinarLink(fx.SPREADSHEET_ID);
  const custoSemId = [
    ['Custo', 'Valor', 'Dia_Vencimento', 'Frequência', 'Data_Início', 'Data_Fim', 'Status', 'Status_Pagamento', 'ID'],
    ['Guardar', 100, 9, 'Mensal', '', '', 'Ativo', 'Pendente', ''],
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    sheets.getTabs.mockImplementation(async (_sid, tabs) => (
      tabs[0] === 'HISTORICO_CUSTOS'
        ? { HISTORICO_CUSTOS: [fx.SHEETS.HISTORICO_CUSTOS[0]] }
        : { CONFIG: fx.SHEETS.CONFIG, PARAMS: fx.SHEETS.PARAMS, RENDA: fx.SHEETS.RENDA, CUSTO_FIXO: custoSemId }
    ));
    sheets.updateColumn.mockResolvedValue();
  });

  test('com sessão: preenche IDs faltando numa única escrita de coluna', async () => {
    const r = await obterMes({ cookies: sessao, mes: '2026-09' });
    expect(r.status).toBe(200);
    expect(sheets.updateColumn).toHaveBeenCalledTimes(1);
    const [, aba, colLetra, linhaInicio, valores] = sheets.updateColumn.mock.calls[0];
    expect(aba).toBe('CUSTO_FIXO');
    expect(colLetra).toBe('I');
    expect(linhaInicio).toBe(2);
    expect(valores[0]).toMatch(/^c-[0-9a-f]{8}$/);
  });

  test('por link (sem sessão): não escreve ID', async () => {
    const r = await obterMes({ cookies: {}, linkToken: link(), mes: '2026-09' });
    expect(r.status).toBe(200);
    expect(sheets.updateColumn).not.toHaveBeenCalled();
  });
});

describe('obterMes — reservas', () => {
  const link = () => auth.assinarLink(fx.SPREADSHEET_ID);
  const base = { CONFIG: fx.SHEETS.CONFIG, PARAMS: fx.SHEETS.PARAMS, RENDA: fx.SHEETS.RENDA, CUSTO_FIXO: fx.SHEETS.CUSTO_FIXO };

  beforeEach(() => {
    jest.clearAllMocks();
    sheets.getTabs.mockResolvedValue(base);
  });

  test('totals.reservado soma só o que foi guardado no mês', async () => {
    sheets.getValues.mockImplementation(async (_sid, range) => (
      range.startsWith('HISTORICO_RESERVAS') ? fx.SHEETS.HISTORICO_RESERVAS
        : range.startsWith('RESERVAS') ? fx.SHEETS.RESERVAS
          : []
    ));
    const r = await obterMes({ cookies: {}, linkToken: link(), mes: '2026-09' });
    expect(r.status).toBe(200);
    expect(r.body.totals.reservado).toBe(300);
  });

  test('planilha sem as abas de reserva -> reservado 0', async () => {
    sheets.getValues.mockImplementation(async (_sid, range) => {
      if (range.startsWith('RESERVAS') || range.startsWith('HISTORICO_RESERVAS')) {
        throw new Error(`Unable to parse range: ${range}`);
      }
      return [];
    });
    const r = await obterMes({ cookies: {}, linkToken: link(), mes: '2026-09' });
    expect(r.status).toBe(200);
    expect(r.body.totals.reservado).toBe(0);
  });
});
