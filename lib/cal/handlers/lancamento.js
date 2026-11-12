
const auth = require('../auth');
const sheets = require('../sheets');
const escrita = require('../escrita');
const schema = require('../schema');
const { gerarId } = require('../ids');
const { atualizarPagamento } = require('./pagamento');
const { primeiroDia, ultimoDia, diasNoMes } = require('../dates');

function paraBr(iso) {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

const AVISO_PAGO_NAO_MARCADO = 'O pagamento foi criado, mas não deu para marcá-lo como pago. Marque-o na lista.';

/**
 * Marca o custo recém-criado como pago em `mes`. Reusa atualizarPagamento (que
 * mexe no HISTORICO_CUSTOS) achando a linha nova pelo ID — ou, sem coluna ID,
 * pela última linha com esse nome. Devolve um aviso se não conseguiu; o custo
 * já existe nesse ponto, então nunca falha a criação.
 */
async function marcarComoPago({ cookies, sid, nome, id, mes }) {
  try {
    const custos = schema.parseCusto(await sheets.getValues(sid, 'CUSTO_FIXO!A1:Z2000'));
    const alvo = id
      ? custos.find((c) => c.id === id)
      : [...custos].reverse().find((c) => schema.norm(c.custo) === schema.norm(nome));
    if (!alvo) return AVISO_PAGO_NAO_MARCADO;
    const r = await atualizarPagamento({ cookies, linhaPlanilha: alvo.linhaPlanilha, id: alvo.id || '', statusPagamento: 'Pago', mes });
    return r.status === 200 ? null : AVISO_PAGO_NAO_MARCADO;
  } catch (err) {
    if (!(err instanceof Error)) throw err;
    console.error('cal/lancamento marcarComoPago error:', err.message);
    return AVISO_PAGO_NAO_MARCADO;
  }
}

async function criarLancamento({ cookies, nome, valor, categoria, dia, mes, repetirTodoMes = true, parcelas, parcelaAtual, dataInicio: dataInicioMes, statusPagamento }) {
  const sessao = auth.lerSessao(cookies);
  if (!sessao) {
    return { status: 401, body: { error: 'Faça login para adicionar pagamentos.' } };
  }

  const nomeLimpo = String(nome || '').trim();
  const valorNum = Number(valor);
  const diaNum = Number(dia);
  if (!nomeLimpo) return { status: 400, body: { error: 'Informe uma descrição.' } };
  if (!Number.isFinite(valorNum) || valorNum <= 0) return { status: 400, body: { error: 'Valor inválido.' } };
  if (!/^\d{4}-\d{2}$/.test(mes || '')) return { status: 400, body: { error: 'Mês inválido.' } };
  if (!Number.isInteger(diaNum) || diaNum < 1 || diaNum > diasNoMes(mes)) {
    return { status: 400, body: { error: 'Dia inválido para o mês informado.' } };
  }

  const parcelado = parcelas != null && parcelas !== '';
  const mesInicio = /^\d{4}-\d{2}$/.test(dataInicioMes || '') ? dataInicioMes : mes;
  let dataInicio = paraBr(primeiroDia(mesInicio));
  let dataFim = repetirTodoMes ? '' : paraBr(ultimoDia(mesInicio));
  let totalParcelas;
  if (parcelado) {
    const campos = escrita.camposParcelado({ parcelas, parcelaAtual, mes });
    if (campos.erro) return { status: 400, body: { error: campos.erro } };
    ({ dataInicio, dataFim, totalParcelas } = campos);
  }

  const valores = await sheets.getValues(sessao.sid, 'CUSTO_FIXO!A1:Z2000');
  // Nome duplicado normal só gera aviso no front (window.confirm); parcelado
  // continua bloqueando no backend porque colidir nomes quebra o casamento
  // das parcelas por nome.
  if (parcelado && escrita.nomeCustoEmUso(valores, nomeLimpo)) {
    return { status: 409, body: { error: escrita.mensagemNomeRepetido(valores, nomeLimpo) } };
  }
  const header = escrita.cabecalhoCusto(valores);
  const campos = [
    { rotulos: ['Custo'], valor: nomeLimpo },
    { rotulos: ['Valor'], valor: valorNum },
    { rotulos: ['Categoria'], valor: categoria || '' },
    { rotulos: ['Dia_Vencimento'], valor: String(diaNum) },
    { rotulos: ['Frequência', 'Frequencia'], valor: 'Mensal' },
    { rotulos: ['Total_Parcelas'], valor: totalParcelas },
    { rotulos: ['Data_Início', 'Data_Inicio'], valor: dataInicio },
    { rotulos: ['Data_Fim'], valor: dataFim },
    { rotulos: ['Status'], valor: 'Ativo' },
    { rotulos: ['Status_Pagamento'], valor: 'Pendente' },
  ];
  let novoId = '';
  if (escrita.indiceColuna(header, 'ID') != null) {
    novoId = gerarId(schema.parseCusto(valores).map((c) => c.id).filter(Boolean));
    campos.push({ rotulos: ['ID'], valor: novoId });
  }
  const linha = escrita.montarLinha(header, campos);

  await sheets.appendRow(sessao.sid, 'CUSTO_FIXO', linha);

  // Já nasce pago: o mês marcado é o da 1ª ocorrência (a parcela atual, se parcelado).
  if (statusPagamento === 'Pago') {
    const aviso = await marcarComoPago({ cookies, sid: sessao.sid, nome: nomeLimpo, id: novoId, mes: parcelado ? mes : mesInicio });
    if (aviso) return { status: 201, body: { ok: true, aviso } };
  }
  return { status: 201, body: { ok: true } };
}

module.exports = { criarLancamento };
