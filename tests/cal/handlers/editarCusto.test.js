'use strict';

process.env.CAL_JWT_SECRET = 'segredo-de-teste-bem-comprido-1234';

jest.mock('../../../lib/cal/sheets');

const sheets = require('../../../lib/cal/sheets');
const auth = require('../../../lib/cal/auth');
const escrita = require('../../../lib/cal/escrita');
const fx = require('../fixtures/planilha');
const { editarCusto } = require('../../../lib/cal/handlers/editarCusto');

const sessaoValida = { [auth.COOKIE_NOME]: auth.assinarSessao({ sid: fx.SPREADSHEET_ID, email: fx.EMAIL }) };
const base = {
  cookies: sessaoValida,
  linhaPlanilha: 2, // Aluguel
  nome: 'Aluguel',
  valor: 950,
  categoria: 'Moradia',
  dia: 1,
  mes: '2026-09',
  repetirTodoMes: true,
};

beforeEach(() => {
  sheets.getValues.mockResolvedValue(fx.SHEETS.CUSTO_FIXO);
  sheets.updateRow.mockResolvedValue();
});

describe('editarCusto — nome repetido', () => {
  test('renomear para o nome de outro custo -> 200 (sem 409; aviso fica no front)', async () => {
    const r = await editarCusto({ ...base, nome: 'Internet' });
    expect(r.status).toBe(200);
    expect(sheets.updateRow).toHaveBeenCalled();
  });

  test('manter o próprio nome (só mudar valor) segue permitido', async () => {
    const r = await editarCusto({ ...base, nome: 'aluguel' });
    expect(r.status).toBe(200);
  });

  test('custo já duplicado na planilha continua editável sem trocar o nome', async () => {
    const custo = fx.clone().CUSTO_FIXO;
    custo.push([...custo[1]]);
    sheets.getValues.mockResolvedValue(custo);
    const r = await editarCusto({ ...base, valor: 1000 });
    expect(r.status).toBe(200);
  });

  test('preserva o ID da linha ao editar', async () => {
    const custo = [
      ['Custo', 'Valor', 'Categoria', 'Dia_Vencimento', 'Frequência', 'Total_Parcelas', 'Data_Início', 'Data_Fim', 'Status', 'Status_Pagamento', 'ID'],
      ['Aluguel', 900, 'Moradia', 1, 'Mensal', '', '', '', 'Ativo', 'Pendente', 'c-keep4242'],
    ];
    sheets.getValues.mockResolvedValue(custo);
    await editarCusto({ ...base, valor: 1000 });
    const row = sheets.updateRow.mock.calls[0][3];
    expect(row[10]).toBe('c-keep4242');
  });
});

describe('editarCusto', () => {
  test('sem sessão -> 401', async () => {
    const r = await editarCusto({ ...base, cookies: {} });
    expect(r.status).toBe(401);
    expect(sheets.updateRow).not.toHaveBeenCalled();
  });

  test('linhaPlanilha inválida -> 400', async () => {
    const r = await editarCusto({ ...base, linhaPlanilha: 1 });
    expect(r.status).toBe(400);
  });

  test('nome vazio -> 400', async () => {
    const r = await editarCusto({ ...base, nome: '  ' });
    expect(r.status).toBe(400);
  });

  test('valor não positivo -> 400', async () => {
    const r = await editarCusto({ ...base, valor: 0 });
    expect(r.status).toBe(400);
  });

  test('dia fora do mês -> 400', async () => {
    const r = await editarCusto({ ...base, dia: 31 }); // setembro tem 30
    expect(r.status).toBe(400);
  });

  test('mês mal formado -> 400', async () => {
    const r = await editarCusto({ ...base, mes: '2026/09' });
    expect(r.status).toBe(400);
  });

  test('status fora do enum -> 400', async () => {
    const r = await editarCusto({ ...base, status: 'Cancelado' });
    expect(r.status).toBe(400);
  });

  test('linha inexistente -> 404', async () => {
    const r = await editarCusto({ ...base, linhaPlanilha: 999 });
    expect(r.status).toBe(404);
    expect(sheets.updateRow).not.toHaveBeenCalled();
  });

  test('preserva colunas não editadas (Observações) e ajusta as editadas', async () => {
    await editarCusto(base);
    const [sid, aba, linha, linhaEditada] = sheets.updateRow.mock.calls[0];
    expect(sid).toBe(fx.SPREADSHEET_ID);
    expect(aba).toBe('CUSTO_FIXO');
    expect(linha).toBe(2);
    const header = escrita.cabecalhoCusto(fx.SHEETS.CUSTO_FIXO);
    expect(linhaEditada[header.indexOf('valor')]).toBe(950);
    expect(linhaEditada[header.indexOf('observacoes')]).toBe(fx.SHEETS.CUSTO_FIXO[1][header.indexOf('observacoes')]);
    expect(linhaEditada[header.indexOf('status_pagamento')]).toBe(fx.SHEETS.CUSTO_FIXO[1][header.indexOf('status_pagamento')]);
  });

  test('não recorrente: Data_Fim vira o fim do mês', async () => {
    await editarCusto({ ...base, repetirTodoMes: false });
    const header = escrita.cabecalhoCusto(fx.SHEETS.CUSTO_FIXO);
    const [, , , linhaEditada] = sheets.updateRow.mock.calls[0];
    expect(linhaEditada[header.indexOf('data_fim')]).toBe('30/09/2026');
  });

  test('recorrente: Data_Fim fica vazia', async () => {
    await editarCusto({ ...base, repetirTodoMes: true });
    const header = escrita.cabecalhoCusto(fx.SHEETS.CUSTO_FIXO);
    const [, , , linhaEditada] = sheets.updateRow.mock.calls[0];
    expect(linhaEditada[header.indexOf('data_fim')]).toBe('');
  });

  test('não mexe em Data_Início (preserva a original)', async () => {
    await editarCusto(base);
    const header = escrita.cabecalhoCusto(fx.SHEETS.CUSTO_FIXO);
    const [, , , linhaEditada] = sheets.updateRow.mock.calls[0];
    expect(linhaEditada[header.indexOf('data_inicio')]).toBe(fx.SHEETS.CUSTO_FIXO[1][header.indexOf('data_inicio')]);
  });

  test('status: Inativo desativa; omitido preserva o original', async () => {
    await editarCusto({ ...base, status: 'Inativo' });
    const header = escrita.cabecalhoCusto(fx.SHEETS.CUSTO_FIXO);
    const [, , , linhaComStatus] = sheets.updateRow.mock.calls[0];
    expect(linhaComStatus[header.indexOf('status')]).toBe('Inativo');

    sheets.updateRow.mockClear();
    await editarCusto(base);
    const [, , , linhaSemStatus] = sheets.updateRow.mock.calls[0];
    expect(linhaSemStatus[header.indexOf('status')]).toBe(fx.SHEETS.CUSTO_FIXO[1][header.indexOf('status')]);
  });

  test('sucesso devolve 200', async () => {
    const r = await editarCusto(base);
    expect(r.status).toBe(200);
  });
});

describe('editarCusto — parcelado', () => {
  // Aluguel (linha 2) vira um parcelado 3x que começou em ago/2026 (parcela 2 em set).
  const planilhaParcelada = () => {
    const custo = fx.clone().CUSTO_FIXO;
    const h = escrita.cabecalhoCusto(custo);
    custo[1][h.indexOf('total_parcelas')] = 3;
    custo[1][h.indexOf('data_inicio')] = '01/08/2026';
    custo[1][h.indexOf('data_fim')] = '31/10/2026';
    return { custo, h };
  };
  const editada = () => sheets.updateRow.mock.calls[0][3];

  test('editar o valor sem parcelas não trunca Data_Fim nem mexe nas datas', async () => {
    const { custo, h } = planilhaParcelada();
    sheets.getValues.mockResolvedValue(custo);
    const r = await editarCusto({ ...base, repetirTodoMes: false });
    expect(r.status).toBe(200);
    expect(editada()[h.indexOf('data_fim')]).toBe('31/10/2026');
    expect(editada()[h.indexOf('data_inicio')]).toBe('01/08/2026');
    expect(editada()[h.indexOf('total_parcelas')]).toBe(3);
  });

  test('repetirTodoMes=true também não apaga Data_Fim de parcelado', async () => {
    const { custo, h } = planilhaParcelada();
    sheets.getValues.mockResolvedValue(custo);
    await editarCusto({ ...base, repetirTodoMes: true });
    expect(editada()[h.indexOf('data_fim')]).toBe('31/10/2026');
  });

  test('alterar parcelas recalcula Total_Parcelas, Data_Início e Data_Fim', async () => {
    const { custo, h } = planilhaParcelada();
    sheets.getValues.mockResolvedValue(custo);
    const r = await editarCusto({ ...base, parcelas: 5, parcelaAtual: 2 });
    expect(r.status).toBe(200);
    expect(editada()[h.indexOf('total_parcelas')]).toBe(5);
    expect(editada()[h.indexOf('data_inicio')]).toBe('01/08/2026');
    expect(editada()[h.indexOf('data_fim')]).toBe('31/12/2026');
  });

  test('parcelaAtual omitida mantém a parcela do mês aberto (deriva de Data_Início)', async () => {
    const { custo, h } = planilhaParcelada();
    sheets.getValues.mockResolvedValue(custo);
    await editarCusto({ ...base, parcelas: 6 });
    expect(editada()[h.indexOf('data_inicio')]).toBe('01/08/2026');
    expect(editada()[h.indexOf('data_fim')]).toBe('31/01/2027');
  });

  test('parcelaAtual maior que parcelas -> 400 sem escrever', async () => {
    const { custo } = planilhaParcelada();
    sheets.getValues.mockResolvedValue(custo);
    const r = await editarCusto({ ...base, parcelas: 3, parcelaAtual: 4 });
    expect(r.status).toBe(400);
    expect(sheets.updateRow).not.toHaveBeenCalled();
  });

  test('reduzir parcelas abaixo da parcela atual -> 400', async () => {
    const { custo } = planilhaParcelada();
    sheets.getValues.mockResolvedValue(custo);
    const r = await editarCusto({ ...base, parcelas: 2, mes: '2026-10' });
    expect(r.status).toBe(400);
    expect(sheets.updateRow).not.toHaveBeenCalled();
  });

  test('custo normal não vira parcelado pela edição -> 400', async () => {
    const r = await editarCusto({ ...base, parcelas: 3 });
    expect(r.status).toBe(400);
    expect(sheets.updateRow).not.toHaveBeenCalled();
  });

  test('custo normal segue com Total_Parcelas vazio e Data_Início intacta', async () => {
    await editarCusto(base);
    const h = escrita.cabecalhoCusto(fx.SHEETS.CUSTO_FIXO);
    expect(editada()[h.indexOf('total_parcelas')]).toBe('');
  });
});

