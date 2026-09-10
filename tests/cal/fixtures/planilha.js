'use strict';

/**
 * Fixture SINTÉTICO — modelado na estrutura da planilha "template cliente
 * internacional", mas sem nenhum dado real de cliente. Serve para exercitar o
 * parser e a projeção. Preserva de propósito as esquisitices do template:
 *
 *  - renda "Semanal" por nome do dia da semana;
 *  - Dia_Vencimento em texto livre ("1 a 5", "15 e 30", "NÃO TEM JUROS...");
 *  - custo sem dia parseável (vai para `semData`);
 *  - compra parcelada (Total_Parcelas preenchido, Data_Fim por fórmula);
 *  - linha inativa (Status != "Ativo");
 *  - linhas parciais / "teste" que o parser deve ignorar.
 *
 * Valores como o Sheets API devolve com valueRenderOption=UNFORMATTED_VALUE:
 * datas = serial Excel, números = number, célula vazia = "".
 */

const SERIAL_HOJE = 46273; // 2026-09-08
const H = 46266; // 2026-09-01 — Data_Início dos custos

const CONFIG = [
  ['Parâmetro', 'Valor', 'Observações'],
  ['Cliente', 'Cliente Exemplo', 'Nome completo do cliente'],
  ['Moeda_Padrão', 'USD', 'Código da moeda usada na planilha'],
  ['Data_Referência', SERIAL_HOJE, 'Data usada pelo calendário (=TODAY())'],
  ['Última_Atualização', 46235, 'Última revisão da lista de Renda/Custo Fixo'],
  ['Email_Cliente', 'cliente@exemplo.com', 'E-mail do cliente para acesso ao calendário'],
];

const PARAMS = [
  ['Parâmetro', 'Valor', 'Observações'],
  ['Meta_de_Investimento', '', 'Objetivo financeiro do cliente'],
  ['Link_Calendário', 'https://script.google.com/macros/s/EXEMPLO/exec', 'Web App legado do Apps Script'],
  ['Título_Estratégia', 'Estratégia de recebimentos', 'Título no topo do calendário'],
  ['Observação_Reserva', 'Acompanhar recibos manualmente', 'Texto livre sobre reserva'],
];

// Fonte_Renda | Valor | Frequência | Dia_Recebimento | Data_Início | Data_Fim | Status | Observações
const RENDA = [
  ['Fonte_Renda', 'Valor', 'Frequência', 'Dia_Recebimento', 'Data_Início', 'Data_Fim', 'Status', 'Observações'],
  ['Salário', 800, 'Semanal', 'Sexta-Feira', 46204, '', 'Ativo', 'exemplo'],
];

// Custo | Valor | Categoria | Dia_Vencimento | Frequência | Total_Parcelas | Parcela_Atual |
//   Data_Início | Data_Fim | Status | Status_Pagamento | Observações
const CUSTO_FIXO = [
  [
    'Custo', 'Valor', 'Categoria', 'Dia_Vencimento', 'Frequência', 'Total_Parcelas',
    'Parcela_Atual', 'Data_Início', 'Data_Fim', 'Status', 'Status_Pagamento', 'Observações',
  ],
  ['Aluguel', 900, 'Moradia', '1 a 5', 'Mensal', '', '', H, '', 'Ativo', 'Pendente', 'texto livre no dia'],
  ['Assinatura A', 19.9, 'Entretenimento', 18, 'Mensal', '', '', H, '', 'Ativo', 'Pendente', ''],
  ['Plano de saúde', 42.84, 'Saúde', 16, 'Mensal', '', '', H, '', 'Ativo', 'Pendente', ''],
  ['', '', '', '', 'Mensal', '', '', H, '', 'Ativo', 'Pendente', ''],
  ['Ferramenta X', 15, 'Software e Ferramentas', 13, 'Mensal', '', '', H, '', 'Ativo', 'Pendente', ''],
  ['Celular', 50, '', '', 'Mensal', '', '', H, '', 'Ativo', 'Pendente', 'sem dia -> semData'],
  ['Internet', 75, '', 16, 'Mensal', '', '', H, '', 'Ativo', 'Pendente', ''],
  ['Compra parcelada A', 16.89, 'Compras', '4 PARCELA DE 4', 'Mensal', 4, '', H, '', 'Ativo', 'Pendente', ''],
  ['Terapia', 20, 'Saúde', '15 e 30', 'Mensal', '', '', H, '', 'Ativo', 'Pendente', 'multi-dia -> pega o 15'],
  ['Dívida congelada', 788, '', 'NÃO TEM JUROS, DÍVIDA CONGELADA', 'Mensal', '', '', H, '', 'Ativo', 'Pendente', 'sem dia -> semData'],
  ['Serviço antigo', 30, '', 10, 'Mensal', '', '', 45900, 46020, 'Inativo', 'Pendente', 'fora da janela + inativo'],
  ['', '', '', '', 'Mensal', 4, '', H, '', 'Ativo', 'Pendente', 'linha parcial sem nome'],
  ['teste'],
];

const ESTRATEGIA = [
  ['Ordem', 'Item', 'Observações'],
  [1, '1º recebimento: separar parte para investimento'],
  [2, '2º recebimento: usar normalmente'],
  [3, '3º recebimento: separar para contas'],
  [4, '4º recebimento: guardar para o aluguel'],
];

const SHEETS = { CONFIG, PARAMS, RENDA, CUSTO_FIXO, ESTRATEGIA };

/** Cópia profunda — um teste pode mutar sem afetar os outros. */
function clone() {
  return JSON.parse(JSON.stringify(SHEETS));
}

module.exports = {
  SPREADSHEET_ID: '1exemploXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  EMAIL: 'cliente@exemplo.com',
  SERIAL_HOJE,
  SHEETS,
  clone,
};
