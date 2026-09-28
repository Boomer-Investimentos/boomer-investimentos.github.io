

const COMBINANTES = new RegExp('[\\u0300-\\u036f]', 'g');

function chave(nome) {
  return String(nome || '')
    .normalize('NFD')
    .replace(COMBINANTES, '')
    .toLowerCase()
    .trim();
}

const CATEGORIAS = [
  { nome: 'Recebimento', icone: '🪙', cor: '#1a7f37' },
  { nome: 'Moradia', icone: '🏠', cor: '#b7791f' },
  { nome: 'Tecnologia', icone: '💻', cor: '#3730a3' },
  { nome: 'Entretenimento', icone: '▶️', cor: '#1d4ed8' },
  { nome: 'Saúde', icone: '🩺', cor: '#be123c' },
  { nome: 'Software e Ferramentas', icone: '🧰', cor: '#4b5563' },
  { nome: 'Compras', icone: '🛍️', cor: '#0f766e' },
  { nome: 'Esportes e Lazer', icone: '⚽', cor: '#f59e0b' }
];

const OUTROS = { nome: 'Outros', icone: '•', cor: '#6b7280' };

const PORCHAVE = new Map(CATEGORIAS.map((c) => [chave(c.nome), c]));

/** Resolve uma categoria (tolerante a acento/caixa/espaço). Nunca lança. */
function categoria(nome) {
  return PORCHAVE.get(chave(nome)) || OUTROS;
}

/** Lista para o payload/legenda do front (inclui "Outros" no fim). */
function legenda() {
  return [...CATEGORIAS, OUTROS].map((c) => ({ ...c }));
}

module.exports = { categoria, legenda, OUTROS };
