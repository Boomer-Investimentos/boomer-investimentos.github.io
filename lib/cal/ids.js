'use strict';

const crypto = require('crypto');

/**
 * ID de custo: prefixo fixo `c-` + 8 hex. O prefixo garante que o keyspace do
 * ID nunca colide com um nome normalizado (schema.norm), então chaves por ID e
 * por nome coexistem no HISTORICO_CUSTOS.
 * @param {Iterable<string>} [existentes] - IDs já em uso, p/ evitar colisão.
 */
function gerarId(existentes) {
  const usados = existentes instanceof Set ? existentes : new Set(existentes || []);
  let id;
  do {
    id = `c-${crypto.randomBytes(4).toString('hex')}`;
  } while (usados.has(id));
  return id;
}

module.exports = { gerarId };
