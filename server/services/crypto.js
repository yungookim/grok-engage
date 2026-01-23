import crypto from 'crypto';
import config from '../config.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;      // 128 bits for GCM
const TAG_LENGTH = 16;     // 128 bits authentication tag
const SALT = 'grok-engage-v1';  // Application-specific salt

let masterKey = null;

/**
 * Derive a 256-bit key from a password using scrypt
 * @param {string} password - The password to derive from
 * @returns {Buffer} 32-byte key
 */
function deriveKey(password) {
    // scrypt with high cost factor for security
    return crypto.scryptSync(password, SALT, 32, {
        N: 16384,   // CPU/memory cost
        r: 8,       // Block size
        p: 1        // Parallelization
    });
}

/**
 * Initialize the master key from password or environment
 * @param {string} password - Optional password (uses MASTER_KEY env if not provided)
 */
export function setMasterKey(password) {
    const keySource = password || config.masterKey;

    if (!keySource) {
        throw new Error('Master key not configured. Set MASTER_KEY in environment or call setMasterKey().');
    }

    masterKey = deriveKey(keySource);
}

/**
 * Check if master key is set
 * @returns {boolean}
 */
export function hasMasterKey() {
    return masterKey !== null || !!config.masterKey;
}

/**
 * Ensure master key is available, initialize from config if needed
 */
function ensureMasterKey() {
    if (!masterKey) {
        if (config.masterKey) {
            setMasterKey(config.masterKey);
        } else {
            throw new Error('Master key not set. Call setMasterKey() first or set MASTER_KEY in environment.');
        }
    }
}

/**
 * Encrypt a string using AES-256-GCM
 * @param {string} plaintext - Text to encrypt
 * @returns {string} Encrypted value in format: IV:TAG:CIPHERTEXT (all hex)
 */
export function encrypt(plaintext) {
    ensureMasterKey();

    if (!plaintext) {
        throw new Error('Cannot encrypt empty value');
    }

    // Generate random IV for each encryption
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);

    // Encrypt
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get authentication tag
    const tag = cipher.getAuthTag();

    // Return as IV:TAG:CIPHERTEXT
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a string encrypted with encrypt()
 * @param {string} encryptedText - Encrypted value from encrypt()
 * @returns {string} Decrypted plaintext
 */
export function decrypt(encryptedText) {
    ensureMasterKey();

    if (!encryptedText) {
        throw new Error('Cannot decrypt empty value');
    }

    // Parse the encrypted format
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted value format');
    }

    const [ivHex, tagHex, ciphertext] = parts;

    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');

    // Validate lengths
    if (iv.length !== IV_LENGTH) {
        throw new Error('Invalid IV length');
    }
    if (tag.length !== TAG_LENGTH) {
        throw new Error('Invalid authentication tag length');
    }

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv);
    decipher.setAuthTag(tag);

    // Decrypt
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

/**
 * Encrypt a credential and store it in the database
 * @param {string} key - Credential key (e.g., 'x_api_key')
 * @param {string} value - Credential value to encrypt
 * @param {function} setCredentialFn - Database function to store credential
 */
export function encryptAndStore(key, value, setCredentialFn) {
    const encrypted = encrypt(value);
    setCredentialFn(key, encrypted);
}

/**
 * Retrieve and decrypt a credential from the database
 * @param {string} key - Credential key
 * @param {function} getCredentialFn - Database function to get credential
 * @returns {string|null} Decrypted value or null if not found
 */
export function retrieveAndDecrypt(key, getCredentialFn) {
    const encrypted = getCredentialFn(key);
    if (!encrypted) {
        return null;
    }
    return decrypt(encrypted);
}

/**
 * Generate a secure random string for use as a master key
 * @param {number} length - Length in bytes (default 32)
 * @returns {string} Hex-encoded random string
 */
export function generateSecureKey(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}

/**
 * Clear the master key from memory (for security)
 */
export function clearMasterKey() {
    if (masterKey) {
        // Overwrite with zeros before releasing
        masterKey.fill(0);
        masterKey = null;
    }
}
