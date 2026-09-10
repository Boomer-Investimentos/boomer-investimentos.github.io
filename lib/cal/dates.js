'use strict';

/**
 * Utilidades de data para o Calendário Financeiro.
 *
 * A planilha guarda datas como serial do Excel (epoch 1899-12-30). Para datas
 * pós-1900-03 o cálculo com 1899-12-30 como dia 0 bate com o Gregoriano
 * (o -1 do "serial 1 = 1900-01-01" e o +1 do bug do 29/02/1900 se cancelam).
 * Todos os nossos dados são de 2026+, então a conversão simples serve.
 */

const MS_DIA = 86400000;
const EPOCH_EXCEL_UTC = Date.UTC(1899, 11, 30);
const TZ = 'America/Sao_Paulo';

const DIAS_SEMANA = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
};

const COMBINANTES = new RegExp('[\\u0300-\\u036f]', 'g');

function semAcento(s) {
  return String(s).normalize('NFD').replace(COMBINANTES, '');
}

/** "YYYY-MM" ou "YYYY-MM-DD" -> { ano, mes } (mes 1-12). */
function parseMes(valor) {
  const m = /^(\d{4})-(\d{2})/.exec(String(valor));
  if (!m) throw new Error(`mês inválido: ${valor}`);
  return { ano: Number(m[1]), mes: Number(m[2]) };
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Serial Excel (número) -> "YYYY-MM-DD". Passa strings adiante inalteradas. */
function serialParaData(serial) {
  if (serial == null || serial === '') return null;
  if (typeof serial === 'string') {
    const s = serial.trim();
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
    if (br) return `${br[3]}-${br[2]}-${br[1]}`;
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    serial = n;
  }
  const d = new Date(EPOCH_EXCEL_UTC + Math.round(serial) * MS_DIA);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** "YYYY-MM-DD" -> serial Excel (inteiro). */
function dataParaSerial(iso) {
  const { ano, mes } = parseMes(iso);
  const dia = Number(/^\d{4}-\d{2}-(\d{2})/.exec(iso)[1]);
  return Math.round((Date.UTC(ano, mes - 1, dia) - EPOCH_EXCEL_UTC) / MS_DIA);
}

/** Data de hoje em America/Sao_Paulo como "YYYY-MM-DD". */
function hojeISO(agora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora);
  return partes; // en-CA já sai "YYYY-MM-DD"
}

/** Serial Excel de hoje (America/Sao_Paulo). */
function hojeSerial(agora = new Date()) {
  return dataParaSerial(hojeISO(agora));
}

/** "YYYY-MM" -> "YYYY-MM" do mês corrente (America/Sao_Paulo). */
function mesAtual(agora = new Date()) {
  return hojeISO(agora).slice(0, 7);
}

function diasNoMes(mesOuIso) {
  const { ano, mes } = parseMes(mesOuIso);
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

function primeiroDia(mes) {
  const { ano, mes: m } = parseMes(mes);
  return `${ano}-${pad2(m)}-01`;
}

function ultimoDia(mes) {
  const { ano, mes: m } = parseMes(mes);
  return `${ano}-${pad2(m)}-${pad2(diasNoMes(mes))}`;
}

/** Limita `dia` ao último dia do mês (dia 31 em mês de 30 -> 30). Min 1. */
function clampDia(dia, mes) {
  const n = Math.trunc(Number(dia));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, diasNoMes(mes));
}

/**
 * Dias do mês (1..N) em que cai um dia da semana informado por nome PT
 * ("Sexta-Feira", "sexta", "Segunda-feira"...). Retorna [] se o nome não casar.
 */
function ocorrenciasDeDiaDaSemana(mes, nomeDia) {
  const chave = semAcento(String(nomeDia).toLowerCase())
    .replace(/[-\s]*feira/g, '')
    .replace(/[-\s]+/g, '')
    .trim();
  const alvo = DIAS_SEMANA[chave];
  if (alvo == null) return [];
  const { ano, mes: m } = parseMes(mes);
  const total = diasNoMes(mes);
  const dias = [];
  for (let d = 1; d <= total; d += 1) {
    if (new Date(Date.UTC(ano, m - 1, d)).getUTCDay() === alvo) dias.push(d);
  }
  return dias;
}

/** Meses de A até B (B - A), por ano*12+mes. Aceita "YYYY-MM" ou "YYYY-MM-DD". */
function mesesEntre(a, b) {
  const A = parseMes(a);
  const B = parseMes(b);
  return B.ano * 12 + (B.mes - 1) - (A.ano * 12 + (A.mes - 1));
}

/** Primeiro inteiro 1..31 achado no texto livre de Dia_Vencimento, ou null. */
function parseDiaVencimento(texto) {
  if (texto == null) return null;
  const m = /\b([12]?\d|3[01])\b/.exec(String(texto));
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 31 ? n : null;
}

module.exports = {
  TZ,
  serialParaData,
  dataParaSerial,
  hojeISO,
  hojeSerial,
  mesAtual,
  diasNoMes,
  primeiroDia,
  ultimoDia,
  clampDia,
  ocorrenciasDeDiaDaSemana,
  mesesEntre,
  parseDiaVencimento,
  parseMes,
};
