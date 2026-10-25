const BASE = '/api/cal';

async function tratarResposta(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erro inesperado. Tente novamente.');
  return data;
}

export function obterMes(mes, linkToken) {
  const qs = new URLSearchParams({ mes });
  if (linkToken) qs.set('s', linkToken);
  return fetch(`${BASE}/mes?${qs}`).then(tratarResposta);
}

export function pedirAcesso(linkToken, email) {
  return fetch(`${BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ s: linkToken, email }),
  }).then(tratarResposta);
}

export function verificarAcesso(magicToken) {
  return fetch(`${BASE}/verificar?t=${encodeURIComponent(magicToken)}`).then(tratarResposta);
}

export function encerrarSessao() {
  return fetch(`${BASE}/logout`, { method: 'POST' }).then(tratarResposta);
}

export function atualizarPagamento(linhaPlanilha, statusPagamento, mes) {
  return fetch(`${BASE}/pagamento`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ linhaPlanilha, statusPagamento, mes }),
  }).then(tratarResposta);
}

export function criarLancamento(dados) {
  return fetch(`${BASE}/lancamento`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  }).then(tratarResposta);
}

export function editarCusto(dados) {
  return fetch(`${BASE}/custo-editar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  }).then(tratarResposta);
}

export function criarRenda(dados) {
  return fetch(`${BASE}/renda-lancamento`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  }).then(tratarResposta);
}

export function editarRenda(dados) {
  return fetch(`${BASE}/renda-editar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  }).then(tratarResposta);
}

export function criarReserva(dados) {
  return fetch(`${BASE}/reserva`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acao: 'criar', ...dados }),
  }).then(tratarResposta);
}

export function editarReserva(dados) {
  return fetch(`${BASE}/reserva`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acao: 'editar', ...dados }),
  }).then(tratarResposta);
}

export function atualizarReserva(linhaPlanilha, statusReserva, mes) {
  return fetch(`${BASE}/reserva`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acao: 'guardar', linhaPlanilha, statusReserva, mes }),
  }).then(tratarResposta);
}
