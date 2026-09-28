'use strict';

/**
 * POST /api/cal/pagamento — alterna/define Status_Pagamento de uma linha de
 * CUSTO_FIXO. Exige sessão (e-mail verificado) — só ter o link do assessor
 * não basta pra escrever, por isso não aceitamos `linkToken` aqui.
 */

const auth = require('../auth');
const sheets = require('../sheets');
const escrita = require('../escrita');

const STATUS_VALIDOS = new Set(['Pago', 'Pendente']);

async function atualizarPagamento({ cookies, linhaPlanilha, statusPagamento }) {
  const sessao = auth.lerSessao(cookies);
  if (!sessao) {
    return { status: 401, body: { error: 'Faça login para editar pagamentos.' } };
  }

  const linha = Number(linhaPlanilha);
  if (!Number.isInteger(linha) || linha < 2) {
    return { status: 400, body: { error: 'linhaPlanilha inválida.' } };
  }
  if (!STATUS_VALIDOS.has(statusPagamento)) {
    return { status: 400, body: { error: 'statusPagamento deve ser "Pago" ou "Pendente".' } };
  }

  const valores = await sheets.getValues(sessao.sid, 'CUSTO_FIXO!A1:Z2000');
  const header = escrita.cabecalhoCusto(valores);
  let a1;
  try {
    a1 = escrita.enderecoCelula('CUSTO_FIXO', header, linha, 'Status_Pagamento');
  } catch {
    return { status: 500, body: { error: 'Não foi possível localizar a coluna Status_Pagamento.' } };
  }

  await sheets.updateCell(sessao.sid, a1, statusPagamento);
  return { status: 200, body: { ok: true, linhaPlanilha: linha, statusPagamento } };
}

module.exports = { atualizarPagamento };
