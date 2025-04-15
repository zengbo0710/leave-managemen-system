import CryptoJS from 'crypto-js';

// Use JWT secret as encryption key
const SECRET_KEY = process.env.JWT_SECRET || 'default-secret-key';

/**
 * Encrypts data using AES encryption
 * @param data - The data to encrypt
 * @returns Encrypted data string
 */
export const encrypt = (data: string): string => {
  if (!data) return '';
  try {
    return CryptoJS.AES.encrypt(data, SECRET_KEY).toString();
  } catch (error) {
    console.error('Error encrypting data:', error);
    return '';
  }
};

/**
 * Decrypts encrypted data
 * @param encryptedData - The encrypted data to decrypt
 * @returns Decrypted data string
 */
export const decrypt = (encryptedData: string): string => {
  if (!encryptedData) return '';
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, SECRET_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('Error decrypting data:', error);
    return '';
  }
};
