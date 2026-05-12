const { createCipheriv, createDecipheriv, randomBytes } = require('node:crypto');

// AES-256-GCM provee confidencialidad + integridad (autenticación).
// Formato del ciphertext: iv(12) : tag(16) : data  (todo en hex)
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

let cachedKey = null;

function getKey() {
  if (cachedKey) return cachedKey;
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error('[crypto] ENCRYPTION_KEY no configurada');

  // Acepta hex (64 chars = 32 bytes) — formato recomendado.
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    cachedKey = Buffer.from(raw, 'hex');
    return cachedKey;
  }

  // Compatibilidad con instalaciones antiguas: utf-8 ≥32 chars, derivamos 32 bytes con SHA-256.
  if (raw.length >= 32) {
    cachedKey = require('node:crypto').createHash('sha256').update(raw, 'utf8').digest();
    return cachedKey;
  }

  throw new Error('[crypto] ENCRYPTION_KEY debe ser 64 hex chars (recomendado) o string utf-8 de ≥32 chars');
}

function encrypt(text) {
  if (text == null) return null;
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const enc = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

function decrypt(text) {
  if (text == null) return null;
  const parts = String(text).split(':');

  try {
    // Formato nuevo (GCM): iv:tag:data
    if (parts.length === 3) {
      const iv = Buffer.from(parts[0], 'hex');
      const tag = Buffer.from(parts[1], 'hex');
      const data = Buffer.from(parts[2], 'hex');
      if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) return null;
      const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
      decipher.setAuthTag(tag);
      const dec = Buffer.concat([decipher.update(data), decipher.final()]);
      return dec.toString('utf8');
    }

    // Formato legacy (CBC): iv:data — solo lectura, no se escriben más.
    if (parts.length === 2) {
      const iv = Buffer.from(parts[0], 'hex');
      const data = Buffer.from(parts[1], 'hex');
      if (iv.length !== 16) return null;
      const legacyKey = getKey().subarray(0, 32);
      const decipher = createDecipheriv('aes-256-cbc', legacyKey, iv);
      const dec = Buffer.concat([decipher.update(data), decipher.final()]);
      return dec.toString('utf8');
    }

    return null;
  } catch {
    return null;
  }
}

module.exports = { encrypt, decrypt };
