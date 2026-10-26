'use strict';

const crypto = require('crypto');

/**
 * ID curto: prefixo + 8 hex (ex.: `c-ab12cd34` p/ custo, `r-...` p/ reserva).
 * O prefixo garante que o keyspace do ID nunca colide com um nome normalizado
 * (schema.norm), então chaves por ID e por nome coexistem no histórico.
 * @param {Iterable<string>} [existentes] - IDs já em uso, p/ evitar colisão.
 * @param {string} [prefixo='c-'] - prefixo do ID.
 */
function gerarId(existentes, prefixo = 'c-') {
  const usados = existentes instanceof Set ? existentes : new Set(existentes || []);
  let id;
  do {
    id = `${prefixo}${crypto.randomBytes(4).toString('hex')}`;
  } while (usados.has(id));
  return id;
}

module.exports = { gerarId };
