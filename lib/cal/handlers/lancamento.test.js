'use strict';

process.env.CAL_JWT_SECRET = 'segredo-de-teste-bem-comprido-1234';

jest.mock('../sheets');

const sheets = require('../sheets');
const auth = require('../auth');
const escrita = require('../escrita');
const fx = require('../../../tests/cal/fixtures/planilha');
const { criarLancamento } = require('./lancamento');

const sessaoValida = { [auth.COOKIE_NOME]: auth.assinarSessao({ sid: fx.SPREADSHEET_ID, email: fx.EMAIL }) };
const base = { cookies: sessaoValida, nome: 'Streaming', valor: 15, categoria: 'Entretenimento', dia: 12, mes: '2026-09' };

beforeEach(() => {
  sheets.getValues.mockResolvedValue(fx.SHEETS.CUSTO_FIXO);
  sheets.appendRow.mockResolvedValue();
});

describe('criarLancamento', () => {
  test('sem sessão -> 401', async () => {
    const r = await criarLancamento({ ...base, cookies: {} });
    expect(r.status).toBe(401);
    expect(sheets.appendRow).not.toHaveBeenCalled();
  });

  test('nome vazio -> 400', async () => {
    const r = await criarLancamento({ ...base, nome: '  ' });
    expect(r.status).toBe(400);
  });

  test('valor não positivo -> 400', async () => {
    const r = await criarLancamento({ ...base, valor: 0 });
    expect(r.status).toBe(400);
  });

  test('dia fora do mês -> 400', async () => {
    const r = await criarLancamento({ ...base, dia: 31 }); // setembro tem 30
    expect(r.status).toBe(400);
  });

  test('mês mal formado -> 400', async () => {
    const r = await criarLancamento({ ...base, mes: '2026/09' });
    expect(r.status).toBe(400);
  });

  test('recorrente: Data_Fim em aberto', async () => {
    await criarLancamento({ ...base, repetirTodoMes: true });
    const header = escrita.cabecalhoCusto(fx.SHEETS.CUSTO_FIXO);
    const linhaEsperada = escrita.montarLinha(header, [
      { rotulos: ['Custo'], valor: 'Streaming' },
      { rotulos: ['Valor'], valor: 15 },
      { rotulos: ['Categoria'], valor: 'Entretenimento' },
      { rotulos: ['Dia_Vencimento'], valor: '12' },
      { rotulos: ['Frequência', 'Frequencia'], valor: 'Mensal' },
      { rotulos: ['Data_Início', 'Data_Inicio'], valor: '01/09/2026' },
      { rotulos: ['Data_Fim'], valor: '' },
      { rotulos: ['Status'], valor: 'Ativo' },
      { rotulos: ['Status_Pagamento'], valor: 'Pendente' },
    ]);
    expect(sheets.appendRow).toHaveBeenCalledWith(fx.SPREADSHEET_ID, 'CUSTO_FIXO', linhaEsperada);
  });

  test('não recorrente: Data_Início e Data_Fim no mesmo mês', async () => {
    await criarLancamento({ ...base, repetirTodoMes: false });
    const [, , linha] = sheets.appendRow.mock.calls[0];
    const header = escrita.cabecalhoCusto(fx.SHEETS.CUSTO_FIXO);
    expect(linha[header.indexOf('data_inicio')]).toBe('01/09/2026');
    expect(linha[header.indexOf('data_fim')]).toBe('30/09/2026');
  });

  test('sucesso devolve 201', async () => {
    const r = await criarLancamento(base);
    expect(r.status).toBe(201);
  });
});
