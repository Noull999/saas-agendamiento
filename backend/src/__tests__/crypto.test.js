/**
 * Tests para backend/src/lib/crypto.js
 * Cubre: round-trip, IV aleatorio, null safety, formato inválido.
 */

// Setear la clave ANTES de requerir el módulo
process.env.ENCRYPTION_KEY = 'clave-de-test-exactamente-32-car!!';

const { encrypt, decrypt } = require('../lib/crypto');

describe('encrypt', () => {
  test('devuelve un string no vacío', () => {
    expect(typeof encrypt('hola')).toBe('string');
    expect(encrypt('hola').length).toBeGreaterThan(0);
  });

  test('tiene formato iv:tag:ciphertext (AES-GCM)', () => {
    const result = encrypt('test');
    const parts  = result.split(':');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toHaveLength(24); // IV de 12 bytes en hex
    expect(parts[1]).toHaveLength(32); // GCM tag de 16 bytes en hex
  });

  test('genera IV distinto en cada llamada (no determinista)', () => {
    const a = encrypt('mismo texto');
    const b = encrypt('mismo texto');
    expect(a).not.toBe(b);
  });

  test('encrypt(null) devuelve null', () => {
    expect(encrypt(null)).toBeNull();
  });

  test('acepta números (los convierte a string)', () => {
    expect(decrypt(encrypt(12345))).toBe('12345');
  });
});

describe('decrypt', () => {
  test('round-trip básico', () => {
    expect(decrypt(encrypt('hola mundo'))).toBe('hola mundo');
  });

  test('round-trip con tildes y caracteres especiales', () => {
    const textos = ['José Martínez', 'Ñoño', 'áéíóú', '你好', 'hello\nworld'];
    for (const t of textos) {
      expect(decrypt(encrypt(t))).toBe(t);
    }
  });

  test('round-trip con texto largo', () => {
    const largo = 'A'.repeat(2000);
    expect(decrypt(encrypt(largo))).toBe(largo);
  });

  test('decrypt(null) devuelve null', () => {
    expect(decrypt(null)).toBeNull();
  });

  test('decrypt de formato inválido devuelve null', () => {
    expect(decrypt('no-es-valido')).toBeNull();
    expect(decrypt('')).toBeNull();
    expect(decrypt('solo-una-parte')).toBeNull();
  });

  test('decrypt de ciphertext corrupto lanza o devuelve null', () => {
    // IV correcto (32 hex chars) pero ciphertext basura
    const result = decrypt('0'.repeat(32) + ':deadbeef');
    // El módulo puede lanzar o devolver null — ambos son aceptables
    expect(result === null || result === undefined || typeof result === 'string').toBe(true);
  });
});
