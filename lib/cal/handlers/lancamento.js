
const auth = require('../auth');
const sheets = require('../sheets');
const escrita = require('../escrita');
const schema = require('../schema');
const { gerarId } = require('../ids');
const { primeiroDia, ultimoDia, diasNoMes } = require('../dates');

function paraBr(iso) {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

async function criarLancamento({ cookies, nome, valor, categoria, dia, mes, repetirTodoMes = true, parcelas, parcelaAtual }) {
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
  let dataInicio = paraBr(primeiroDia(mes));
  let dataFim = repetirTodoMes ? '' : paraBr(ultimoDia(mes));
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
  if (escrita.indiceColuna(header, 'ID') != null) {
    campos.push({ rotulos: ['ID'], valor: gerarId(schema.parseCusto(valores).map((c) => c.id).filter(Boolean)) });
  }
  const linha = escrita.montarLinha(header, campos);

  await sheets.appendRow(sessao.sid, 'CUSTO_FIXO', linha);
  return { status: 201, body: { ok: true } };
}

module.exports = { criarLancamento };
