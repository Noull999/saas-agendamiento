/**
 * Valida un RUT chileno (formato: 12345678-9, 12.345.678-9, o 123456789)
 * Acepta dígito verificador en mayúscula o minúscula.
 */
function isValidRut(rut) {
  const cleaned = String(rut).replace(/\./g, '').replace(/-/g, '').trim().toLowerCase();
  if (cleaned.length < 2) return false;

  const body = cleaned.slice(0, -1);
  const dv   = cleaned.slice(-1);

  if (!/^\d+$/.test(body)) return false;

  let sum = 0, m = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * m;
    m = m === 7 ? 2 : m + 1;
  }
  const mod      = 11 - (sum % 11);
  const expected = mod === 11 ? '0' : mod === 10 ? 'k' : String(mod);
  return dv === expected;
}

module.exports = { isValidRut };
