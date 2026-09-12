// Real cryptography used across the prototype.
// Ed25519 for identity/attestation signatures, AES-256-GCM for user storage,
// SHA-256 for measuring the software stack. Nothing here is faked — the client
// displays the actual hashes and signatures produced by these functions.
import crypto from 'crypto';

export function genKeyPair() {
  return crypto.generateKeyPairSync('ed25519');
}

// Compact hex fingerprint of a public key (like a device/hub certificate id).
export function pubHex(publicKey) {
  return publicKey.export({ type: 'spki', format: 'der' }).toString('hex');
}

export function shortId(hex) {
  return hex.slice(0, 8) + '…' + hex.slice(-6);
}

export function sign(privateKey, data) {
  return crypto.sign(null, Buffer.from(data), privateKey).toString('hex');
}

export function verify(publicKey, data, sigHex) {
  try {
    return crypto.verify(null, Buffer.from(data), publicKey, Buffer.from(sigHex, 'hex'));
  } catch {
    return false;
  }
}

export function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// Derive a 32-byte storage key from a secret (guest token secret).
export function deriveKey(secret) {
  return crypto.createHash('sha256').update('storage:' + secret).digest();
}

export function aesEncrypt(keyBuf, plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuf, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv: iv.toString('hex'), data: enc.toString('hex'), tag: tag.toString('hex') };
}

export function aesDecrypt(keyBuf, blob) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, Buffer.from(blob.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(blob.tag, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(blob.data, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}

export function randomSecret() {
  return crypto.randomBytes(16).toString('hex');
}
