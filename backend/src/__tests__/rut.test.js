/**
 * Tests para backend/src/lib/rut.js
 * Cubre: RUTs válidos calculados, inválidos, bordes y formatos variados.
 *
 * DV calculado con módulo 11 chileno:
 *   1→9  2→7  6→k  10→8  12345678→5  7654321→6  11111111→1  22222222→2
 */

const { isValidRut } = require('../lib/rut');

describe('isValidRut — casos válidos', () => {
  const validos = [
    '1-9',           // body: 1  → DV 9
    '2-7',           // body: 2  → DV 7
    '6-k',           // body: 6  → DV k
    '10-8',          // body: 10 → DV 8
    '12345678-5',    // body: 12345678 → DV 5
    '7654321-6',     // body: 7654321  → DV 6
    '11.111.111-1',  // con puntos y guión
    '22222222-2',    // sin puntos
    '6-K',           // K mayúscula (debe ser equivalente a k)
    '12.345.678-5',  // 12345678-5 con formato completo
  ];

  test.each(validos)('%s es válido', rut => {
    expect(isValidRut(rut)).toBe(true);
  });
});

describe('isValidRut — casos inválidos', () => {
  const invalidos = [
    '12345678-9',   // DV incorrecto (correcto sería 5)
    '12345678-0',   // DV incorrecto
    '7654321-k',    // DV incorrecto (correcto sería 6)
    '1-0',          // DV incorrecto para body 1
    '0',            // demasiado corto
    '',             // vacío
    'abcdefgh-1',   // letras en cuerpo
    null,
    undefined,
  ];

  test.each(invalidos)('%s es inválido', rut => {
    expect(isValidRut(rut)).toBe(false);
  });
});

describe('isValidRut — equivalencia de formatos', () => {
  test('con puntos, con guión y sin separadores son equivalentes', () => {
    const r1 = isValidRut('12345678-5');
    const r2 = isValidRut('12.345.678-5');
    const r3 = isValidRut('123456785');
    expect(r1).toBe(r2);
    expect(r2).toBe(r3);
    expect(r1).toBe(true);
  });

  test('DV k y K son equivalentes', () => {
    expect(isValidRut('6-k')).toBe(isValidRut('6-K'));
  });
});
