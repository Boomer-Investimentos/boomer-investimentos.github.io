'use strict';

process.env.CAL_JWT_SECRET = 'segredo-de-teste-bem-comprido-1234';

jest.mock('../../../lib/cal/sheets');

const sheets = require('../../../lib/cal/sheets');
const auth = require('../../../lib/cal/auth');
const escrita = require('../../../lib/cal/escrita');
const fx = require('../fixtures/planilha');
const { criarLancamento } = require('../../../lib/cal/handlers/lancamento');

const sessaoValida = { [auth.COOKIE_NOME]: auth.assinarSessao({ sid: fx.SPREADSHEET_ID, email: fx.EMAIL }) };
const base = { cookies: sessaoValida, nome: 'Streaming', valor: 15, categoria: 'Entretenimento', dia: 12, mes: '2026-09' };

beforeEach(() => {
  sheets.getValues.mockResolvedValue(fx.SHEETS.CUSTO_FIXO);
  sheets.appendRow.mockResolvedValue();
});

describe('criarLancamento — nome repetido', () => {
  test('nome já existente (ignora caixa/acento) -> 409 com sugestão, sem escrever', async () => {
    const r = await criarLancamento({ ...base, nome: 'aluguel' });
    expect(r.status).toBe(409);
    expect(r.body.error).toContain('Você já adicionou "aluguel"');
    expect(r.body.error).toContain('"aluguel 2"');
    expect(sheets.appendRow).not.toHaveBeenCalled();
  });

  test('sugestão pula números já usados (Aluguel 2 existe -> Aluguel 3)', async () => {
    const custo = fx.clone().CUSTO_FIXO;
    custo.push([...custo[1]]);
    custo[custo.length - 1][0] = 'Aluguel 2';
    sheets.getValues.mockResolvedValue(custo);
    const r = await criarLancamento({ ...base, nome: 'Aluguel' });
    expect(r.status).toBe(409);
    expect(r.body.error).toContain('"Aluguel 3"');
  });
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

describe('criarLancamento — parcelado', () => {
  const header = escrita.cabecalhoCusto(fx.SHEETS.CUSTO_FIXO);
  const linhaGravada = () => sheets.appendRow.mock.calls[0][2];

  test('3 parcelas, parcela atual 1: começa no mês aberto e termina 2 meses depois', async () => {
    const r = await criarLancamento({ ...base, parcelas: 3 });
    expect(r.status).toBe(201);
    const linha = linhaGravada();
    expect(linha[header.indexOf('total_parcelas')]).toBe(3);
    expect(linha[header.indexOf('data_inicio')]).toBe('01/09/2026');
    expect(linha[header.indexOf('data_fim')]).toBe('30/11/2026');
    expect(linha[header.indexOf('frequencia')]).toBe('Mensal');
  });

  test('parcela atual 2: Data_Início recua um mês', async () => {
    await criarLancamento({ ...base, parcelas: 3, parcelaAtual: 2 });
    const linha = linhaGravada();
    expect(linha[header.indexOf('data_inicio')]).toBe('01/08/2026');
    expect(linha[header.indexOf('data_fim')]).toBe('31/10/2026');
  });

  test('recuo atravessa o ano (parcela 3 em janeiro começa em novembro)', async () => {
    await criarLancamento({ ...base, mes: '2027-01', parcelas: 6, parcelaAtual: 3 });
    const linha = linhaGravada();
    expect(linha[header.indexOf('data_inicio')]).toBe('01/11/2026');
    expect(linha[header.indexOf('data_fim')]).toBe('30/04/2027');
  });

  test('repetirTodoMes é ignorado quando parcelado', async () => {
    await criarLancamento({ ...base, parcelas: 2, repetirTodoMes: true });
    expect(linhaGravada()[header.indexOf('data_fim')]).toBe('31/10/2026');
  });

  test('sem parcelas não preenche Total_Parcelas', async () => {
    await criarLancamento(base);
    expect(linhaGravada()[header.indexOf('total_parcelas')]).toBe('');
  });

  test.each([
    ['parcelas menor que 2', { parcelas: 1 }],
    ['parcelas acima de 120', { parcelas: 121 }],
    ['parcelas não inteiro', { parcelas: 2.5 }],
    ['parcelas não numérico', { parcelas: 'abc' }],
    ['parcela atual maior que parcelas', { parcelas: 3, parcelaAtual: 4 }],
    ['parcela atual menor que 1', { parcelas: 3, parcelaAtual: 0 }],
  ])('%s -> 400 sem escrever', async (_, extra) => {
    const r = await criarLancamento({ ...base, ...extra });
    expect(r.status).toBe(400);
    expect(sheets.appendRow).not.toHaveBeenCalled();
  });

  test('nome repetido continua barrando parcelado (409)', async () => {
    const r = await criarLancamento({ ...base, nome: 'Aluguel', parcelas: 3 });
    expect(r.status).toBe(409);
    expect(sheets.appendRow).not.toHaveBeenCalled();
  });
});
