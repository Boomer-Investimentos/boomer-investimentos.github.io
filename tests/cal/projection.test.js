'use strict';

const { projetarMes } = require('../../lib/cal/projection');
const schema = require('../../lib/cal/schema');
const fx = require('./fixtures/planilha');

const renda = schema.parseRenda(fx.SHEETS.RENDA);
const custo = schema.parseCusto(fx.SHEETS.CUSTO_FIXO);

function diaCom(proj, dia) {
  return proj.dias.find((d) => d.dia === dia);
}

describe('projetarMes — fixture "template cliente internacional"', () => {
  const proj = projetarMes({ renda, custo, mes: '2026-09', hoje: '2026-09-08' });

  test('devolve um dia por dia do mês, em ordem', () => {
    expect(proj.dias).toHaveLength(30);
    expect(proj.dias.map((d) => d.dia)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  });

  test('Aluguel ("1 a 5") cai no dia 1 e já está atrasado (hoje=8, Pendente)', () => {
    const item = diaCom(proj, 1).itens.find((i) => i.nome === 'Aluguel');
    expect(item).toMatchObject({ tipo: 'custo', valor: 900, statusPagamento: 'pendente', atrasado: true });
    expect(item.categoria.nome).toBe('Moradia');
  });

  test('Terapia ("15 e 30") pega o primeiro dia (15), ainda não atrasado', () => {
    const item = diaCom(proj, 15).itens.find((i) => i.nome === 'Terapia');
    expect(item).toMatchObject({ valor: 20, statusPagamento: 'pendente', atrasado: false });
  });

  test('dois custos no mesmo dia (16): Plano de saúde e Internet', () => {
    const nomes = diaCom(proj, 16).itens.map((i) => i.nome).sort();
    expect(nomes).toEqual(['Internet', 'Plano de saúde']);
  });

  test('compra parcelada cai no dia da parcela (4) e está atrasada', () => {
    const item = diaCom(proj, 4).itens.find((i) => i.nome === 'Compra parcelada A');
    expect(item).toMatchObject({ valor: 16.89, atrasado: true });
  });

  test('custo sem dia parseável vai para semData, não para nenhum dia', () => {
    const nomesSemData = proj.semData.map((i) => i.nome).sort();
    expect(nomesSemData).toEqual(['Celular', 'Dívida congelada']);
    expect(proj.dias.every((d) => !d.itens.some((i) => i.nome === 'Celular'))).toBe(true);
  });

  test('linha inativa (Serviço antigo) não aparece em nenhum dia nem em semData', () => {
    const todosNomes = [...proj.dias.flatMap((d) => d.itens.map((i) => i.nome)), ...proj.semData.map((i) => i.nome)];
    expect(todosNomes).not.toContain('Serviço antigo');
  });

  test('renda semanal (Sexta-feira) ocorre nas 4 sextas de setembro/2026', () => {
    const diasComSalario = proj.dias.filter((d) => d.itens.some((i) => i.nome === 'Salário')).map((d) => d.dia);
    expect(diasComSalario).toEqual([4, 11, 18, 25]);
    const item = diaCom(proj, 4).itens.find((i) => i.nome === 'Salário');
    expect(item).toMatchObject({ tipo: 'renda', valor: 800 });
    expect(item.categoria.nome).toBe('Recebimento');
  });

  test('totais agregam custos por status e receita separadamente', () => {
    expect(proj.totals).toEqual({
      pago: 0,
      pendente: 1010.74,
      atrasado: 916.89,
      receita: 3200,
      reservado: 0,
    });
  });

  test('inclui a legenda completa de categorias (com Outros por último)', () => {
    expect(proj.categorias[proj.categorias.length - 1].nome).toBe('Outros');
    expect(proj.categorias.length).toBeGreaterThan(1);
  });
});

describe('projetarMes — status pago não conta como atrasado mesmo se a data já passou', () => {
  test('custo pago no passado entra em "pago", não em "atrasado"', () => {
    const c = [{
      custo: 'Aluguel', valor: 100, categoria: 'Moradia', dia: 1, dataInicio: null, dataFim: null,
      ativo: true, statusPagamento: 'Pendente', linhaPlanilha: 2,
    }];
    const historico = { 'aluguel|2026': { linhaPlanilha: 2, meses: { 9: 100 } } };
    const proj = projetarMes({ renda: [], custo: c, historico, mes: '2026-09', hoje: '2026-09-20' });
    const item = diaCom(proj, 1).itens[0];
    expect(item).toMatchObject({ statusPagamento: 'pago', atrasado: false });
    expect(proj.totals).toMatchObject({ pago: 100, pendente: 0, atrasado: 0 });
  });

  test('pago em setembro não vale para outubro (mês seguinte volta a pendente)', () => {
    const c = [{
      custo: 'Aluguel', valor: 100, categoria: 'Moradia', dia: 1, dataInicio: null, dataFim: null,
      ativo: true, statusPagamento: 'Pago', linhaPlanilha: 2,
    }];
    const historico = { 'aluguel|2026': { linhaPlanilha: 2, meses: { 9: 100 } } };
    const proj = projetarMes({ renda: [], custo: c, historico, mes: '2026-10', hoje: '2026-10-20' });
    expect(diaCom(proj, 1).itens[0]).toMatchObject({ statusPagamento: 'pendente', atrasado: true });
    expect(proj.totals).toMatchObject({ pago: 0, atrasado: 100 });
  });

  test('sem histórico, Status_Pagamento da CUSTO_FIXO é ignorado', () => {
    const c = [{
      custo: 'Aluguel', valor: 100, categoria: 'Moradia', dia: 1, dataInicio: null, dataFim: null,
      ativo: true, statusPagamento: 'Pago', linhaPlanilha: 2,
    }];
    const proj = projetarMes({ renda: [], custo: c, mes: '2026-09', hoje: '2026-09-20' });
    expect(diaCom(proj, 1).itens[0].statusPagamento).toBe('pendente');
  });
});

describe('projetarMes — vencimento igual a hoje não é atrasado', () => {
  test('data === hoje conta como pendente, não atrasado', () => {
    const c = [{
      custo: 'Fatura', valor: 50, categoria: 'Outros', dia: 8, dataInicio: null, dataFim: null,
      ativo: true, statusPagamento: 'Pendente', linhaPlanilha: 2,
    }];
    const proj = projetarMes({ renda: [], custo: c, mes: '2026-09', hoje: '2026-09-08' });
    expect(diaCom(proj, 8).itens[0].atrasado).toBe(false);
  });
});

describe('projetarMes — janela de validade (Data_Início/Data_Fim)', () => {
  test('custo mensal fora da janela não aparece nem em semData', () => {
    const c = [{
      custo: 'Serviço encerrado', valor: 30, categoria: 'Outros', dia: 10,
      dataInicio: '2026-01-01', dataFim: '2026-08-31', ativo: true,
      statusPagamento: 'Pendente', linhaPlanilha: 5,
    }];
    const proj = projetarMes({ renda: [], custo: c, mes: '2026-09', hoje: '2026-09-08' });
    expect(proj.dias.flatMap((d) => d.itens)).toHaveLength(0);
    expect(proj.semData).toHaveLength(0);
  });

  test('renda semanal fora da janela filtra só as datas fora do range', () => {
    const r = [{
      fonte: 'Bônus semanal', valor: 50, frequencia: 'semanal', diaRecebimento: 'sexta',
      dataInicio: '2026-09-12', dataFim: null, ativo: true,
    }];
    const proj = projetarMes({ renda: r, custo: [], mes: '2026-09', hoje: '2026-09-08' });
    const diasComBonus = proj.dias.filter((d) => d.itens.some((i) => i.nome === 'Bônus semanal')).map((d) => d.dia);
    expect(diasComBonus).toEqual([18, 25]);
  });
});

describe('projetarMes — renda mensal (não semanal) por dia numérico', () => {
  test('salário mensal no dia informado', () => {
    const r = [{
      fonte: 'Salário mensal', valor: 3000, frequencia: 'mensal', diaRecebimento: '5',
      dataInicio: null, dataFim: null, ativo: true,
    }];
    const proj = projetarMes({ renda: r, custo: [], mes: '2026-09', hoje: '2026-09-08' });
    expect(diaCom(proj, 5).itens[0]).toMatchObject({ nome: 'Salário mensal', valor: 3000 });
    expect(proj.totals.receita).toBe(3000);
  });

  test('sem dia parseável no Dia_Recebimento -> nenhuma ocorrência', () => {
    const r = [{
      fonte: 'Comissão variável', valor: 200, frequencia: 'mensal', diaRecebimento: 'a combinar',
      dataInicio: null, dataFim: null, ativo: true,
    }];
    const proj = projetarMes({ renda: r, custo: [], mes: '2026-09', hoje: '2026-09-08' });
    expect(proj.dias.flatMap((d) => d.itens)).toHaveLength(0);
  });

  test('dia numérico fora da janela de validade é filtrado', () => {
    const r = [{
      fonte: 'Renda futura', valor: 100, frequencia: 'mensal', diaRecebimento: '5',
      dataInicio: '2026-10-01', dataFim: null, ativo: true,
    }];
    const proj = projetarMes({ renda: r, custo: [], mes: '2026-09', hoje: '2026-09-08' });
    expect(proj.dias.flatMap((d) => d.itens)).toHaveLength(0);
  });
});

describe('projetarMes — Frequência "Única" sem parcelamento não recorre além do mês de início', () => {
  test('custo único (sem Total_Parcelas, sem Data_Fim) só ocorre no mês de Data_Início', () => {
    const c = [{
      custo: 'Presente de aniversário', valor: 200, categoria: 'Outros', dia: 10,
      dataInicio: '2026-09-01', dataFim: null, totalParcelas: null,
      frequencia: 'unica', ativo: true, statusPagamento: 'Pendente', linhaPlanilha: 4,
    }];
    const emSetembro = projetarMes({ renda: [], custo: c, mes: '2026-09', hoje: '2026-09-08' });
    expect(diaCom(emSetembro, 10).itens).toHaveLength(1);

    const emOutubro = projetarMes({ renda: [], custo: c, mes: '2026-10', hoje: '2026-09-08' });
    expect(emOutubro.dias.flatMap((d) => d.itens)).toHaveLength(0);
  });

  test('custo único PARCELADO (Total_Parcelas + Data_Fim já calculada) ainda recorre nos meses das parcelas', () => {
    const c = [{
      custo: 'Notebook', valor: 120, categoria: 'Tecnologia', dia: 10, totalParcelas: 12,
      dataInicio: '2026-09-01', dataFim: '2027-08-31',
      frequencia: 'unica', ativo: true, statusPagamento: 'Pendente', linhaPlanilha: 4,
    }];
    const emOutubro = projetarMes({ renda: [], custo: c, mes: '2026-10', hoje: '2026-09-08' });
    expect(diaCom(emOutubro, 10).itens).toHaveLength(1);
  });

  test('renda única (bônus, sem Data_Fim) só ocorre no mês de Data_Início', () => {
    const r = [{
      fonte: 'Bônus anual', valor: 500, frequencia: 'unica', diaRecebimento: '15',
      dataInicio: '2026-09-01', dataFim: null, ativo: true,
    }];
    const emSetembro = projetarMes({ renda: r, custo: [], mes: '2026-09', hoje: '2026-09-08' });
    expect(diaCom(emSetembro, 15).itens).toHaveLength(1);

    const emOutubro = projetarMes({ renda: r, custo: [], mes: '2026-10', hoje: '2026-09-08' });
    expect(emOutubro.dias.flatMap((d) => d.itens)).toHaveLength(0);
  });
});

describe('projetarMes — custo/renda inativos são ignorados', () => {
  test('ativo:false não gera ocorrências', () => {
    const c = [{
      custo: 'Cancelado', valor: 10, categoria: 'Outros', dia: 5, dataInicio: null, dataFim: null,
      ativo: false, statusPagamento: 'Pendente', linhaPlanilha: 3,
    }];
    const r = [{
      fonte: 'Renda extinta', valor: 10, frequencia: 'mensal', diaRecebimento: '5',
      dataInicio: null, dataFim: null, ativo: false,
    }];
    const proj = projetarMes({ renda: r, custo: c, mes: '2026-09', hoje: '2026-09-08' });
    expect(proj.dias.flatMap((d) => d.itens)).toHaveLength(0);
  });
});

const HEADER_ID = [
  'Custo', 'Valor', 'Categoria', 'Dia_Vencimento', 'Frequência', 'Total_Parcelas',
  'Data_Início', 'Data_Fim', 'Status', 'Status_Pagamento', 'ID',
];
const HEADER_HIST_ID = [
  'Custo', 'Ano', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez', 'ID',
];
const custoNoDia = (proj, dia) => proj.dias.find((d) => d.dia === dia).itens.find((i) => i.tipo === 'custo');

describe('projetarMes — pago por ID', () => {
  test('mesmo nome, IDs diferentes: só o custo com registro id-keyed fica pago', () => {
    const custo = schema.parseCusto([
      HEADER_ID,
      ['Guardar (Aluguel)', 100, '', 9, 'Mensal', '', '', '', 'Ativo', 'Pendente', 'c-aaaa1111'],
      ['Guardar (Aluguel)', 100, '', 16, 'Mensal', '', '', '', 'Ativo', 'Pendente', 'c-bbbb2222'],
    ]);
    const historico = schema.parseHistorico([
      HEADER_HIST_ID,
      ['Guardar (Aluguel)', 2026, '', '', '', '', '', '', '', '', 100, '', '', '', 'c-aaaa1111'],
    ]);
    const proj = projetarMes({ renda: [], custo, historico, mes: '2026-09', hoje: '2026-09-08' });
    expect(custoNoDia(proj, 9).statusPagamento).toBe('pago');
    expect(custoNoDia(proj, 16).statusPagamento).toBe('pendente');
  });

  test('fallback: custo com ID mas histórico ainda por nome (nome único) conta como pago', () => {
    const custo = schema.parseCusto([
      HEADER_ID,
      ['Internet', 75, '', 10, 'Mensal', '', '', '', 'Ativo', 'Pendente', 'c-cccc3333'],
    ]);
    const historico = schema.parseHistorico([
      HEADER_HIST_ID,
      ['Internet', 2026, '', '', '', '', '', '', '', '', 75, '', '', '', ''],
    ]);
    const proj = projetarMes({ renda: [], custo, historico, mes: '2026-09', hoje: '2026-09-08' });
    expect(custoNoDia(proj, 10).statusPagamento).toBe('pago');
  });
});

describe('projetarMes — reservas', () => {
  const reservas = schema.parseReserva(fx.SHEETS.RESERVAS);
  const historicoReservas = schema.parseHistorico(fx.SHEETS.HISTORICO_RESERVAS, 'Reserva');

  test('guardada no mês entra em reservado; não guardada fica pendente e não soma', () => {
    const proj = projetarMes({ renda, custo, reservas, historicoReservas, mes: '2026-09', hoje: '2026-09-08' });
    expect(proj.totals.reservado).toBe(300);
    const emerg = diaCom(proj, 10).itens.find((i) => i.nome === 'Reserva de emergência');
    expect(emerg).toMatchObject({ tipo: 'reserva', statusReserva: 'guardado', atrasado: false });
    const viagem = diaCom(proj, 20).itens.find((i) => i.nome === 'Viagem');
    expect(viagem).toMatchObject({ tipo: 'reserva', statusReserva: 'pendente' });
  });

  test('reserva nunca fica atrasada, mesmo com data vencida e sem marcação', () => {
    const proj = projetarMes({ renda, custo, reservas, historicoReservas, mes: '2026-09', hoje: '2026-09-30' });
    expect(diaCom(proj, 20).itens.find((i) => i.nome === 'Viagem').atrasado).toBe(false);
  });

  test('não mexe nos totais de custo (pago/pendente/atrasado)', () => {
    const sem = projetarMes({ renda, custo, mes: '2026-09', hoje: '2026-09-08' });
    const com = projetarMes({ renda, custo, reservas, historicoReservas, mes: '2026-09', hoje: '2026-09-08' });
    expect(com.totals.pago).toBe(sem.totals.pago);
    expect(com.totals.pendente).toBe(sem.totals.pendente);
    expect(com.totals.atrasado).toBe(sem.totals.atrasado);
  });

  test('mês sem marcação de guardado: reservado = 0', () => {
    const proj = projetarMes({ renda, custo, reservas, historicoReservas, mes: '2026-10', hoje: '2026-10-15' });
    expect(proj.totals.reservado).toBe(0);
  });

  test('reserva inativa não aparece', () => {
    const proj = projetarMes({ renda, custo, reservas, historicoReservas, mes: '2026-09', hoje: '2026-09-08' });
    expect(proj.dias.flatMap((d) => d.itens.map((i) => i.nome))).not.toContain('Reserva antiga');
  });
});
