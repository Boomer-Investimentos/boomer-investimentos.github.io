const DANGEROUS_LEADING_CHARS = /^[=+\-@\t\r]/;

function sanitizeFormulaInjection(value) {
  if (typeof value !== 'string') return value;
  return DANGEROUS_LEADING_CHARS.test(value) ? `'${value}` : value;
}

function sanitizeDeep(value) {
  if (typeof value === 'string') return sanitizeFormulaInjection(value);
  if (Array.isArray(value)) return value.map(sanitizeDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [key, sanitizeDeep(v)])
    );
  }
  return value;
}

module.exports = { sanitizeFormulaInjection, sanitizeDeep };
