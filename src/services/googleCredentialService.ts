import { encrypt, decrypt } from '../utils/encryption';
import { db } from '../lib/db';
import { googleCredentials } from '../lib/schema';
import { eq } from 'drizzle-orm';

export interface GoogleCredentialData {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * Save Google OAuth credentials to the database with encryption
 */
export async function saveGoogleCredentials(data: GoogleCredentialData): Promise<GoogleCredentialData> {
  try {
    // Encrypt sensitive data before saving
    const encryptedClientId = encrypt(data.clientId);
    const encryptedClientSecret = encrypt(data.clientSecret);
    
    // Check if credentials already exist in the database
    const existingCredentials = await db.select().from(googleCredentials).limit(1);
    
    if (existingCredentials.length > 0) {
      // Update existing credentials
      const credentialId = existingCredentials[0].id;
      await db.update(googleCredentials)
        .set({
          clientId: encryptedClientId,
          clientSecret: encryptedClientSecret,
          redirectUri: data.redirectUri,
          updatedAt: new Date()
        })
        .where(eq(googleCredentials.id, credentialId));
      
      return {
        clientId: data.clientId,
        clientSecret: data.clientSecret,
        redirectUri: data.redirectUri
      };
    } else {
      // Create new credentials
      await db.insert(googleCredentials).values({
        clientId: encryptedClientId,
        clientSecret: encryptedClientSecret,
        redirectUri: data.redirectUri,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      return {
        clientId: data.clientId,
        clientSecret: data.clientSecret,
        redirectUri: data.redirectUri
      };
    }
  } catch (error) {
    console.error('Error saving Google credentials:', error);
    throw error;
  }
}

/**
 * Get Google OAuth credentials from the database and decrypt them
 */
export async function getGoogleCredentials(): Promise<GoogleCredentialData | null> {
  try {
    // Find credentials in the database
    const credentials = await db.select().from(googleCredentials).limit(1);
    
    if (!credentials.length) {
      // If no credentials found, check environment variables
      const envClientId = process.env.GOOGLE_CLIENT_ID;
      const envClientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const envRedirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://developers.google.com/oauthplayground';
      
      if (envClientId && envClientSecret) {
        // Return credentials from environment variables
        return {
          clientId: envClientId,
          clientSecret: envClientSecret,
          redirectUri: envRedirectUri,
        };
      }
      
      return null;
    }
    
    // Decrypt sensitive data
    const credential = credentials[0];
    const decryptedClientId = decrypt(credential.clientId);
    const decryptedClientSecret = decrypt(credential.clientSecret);
    
    return {
      clientId: decryptedClientId,
      clientSecret: decryptedClientSecret,
      redirectUri: credential.redirectUri,
    };
  } catch (error) {
    console.error('Error getting Google credentials:', error);
    throw error;
  }
}

/**
 * Delete Google OAuth credentials from the database
 */
export async function deleteGoogleCredentials(): Promise<boolean> {
  try {
    await db.delete(googleCredentials);
    return true;
  } catch (error) {
    console.error('Error deleting Google credentials:', error);
    throw error;
  }
}

/**
 * Check if Google credentials exist in the database
 */
export async function hasGoogleCredentials(): Promise<boolean> {
  try {
    const credentials = await db.select().from(googleCredentials).limit(1);
    return credentials.length > 0;
  } catch (error) {
    console.error('Error checking for Google credentials:', error);
    throw error;
  }
}
