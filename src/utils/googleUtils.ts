import { getGoogleCredentials } from '../services/googleCredentialService';

/**
 * Gets Google OAuth configuration from database or environment
 * This prioritizes credentials from the database over environment variables
 */
export async function getGoogleOAuthConfig() {
  try {
    // Try to get credentials from database first
    const dbCredentials = await getGoogleCredentials();
    
    if (dbCredentials) {
      return {
        clientId: dbCredentials.clientId,
        clientSecret: dbCredentials.clientSecret,
        redirectUri: dbCredentials.redirectUri,
        source: 'database'
      };
    }
    
    // Fallback to environment variables
    const envClientId = process.env.GOOGLE_CLIENT_ID;
    const envClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const envRedirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://developers.google.com/oauthplayground';
    
    if (envClientId && envClientSecret) {
      return {
        clientId: envClientId,
        clientSecret: envClientSecret,
        redirectUri: envRedirectUri,
        source: 'environment'
      };
    }
    
    // No credentials found
    return null;
  } catch (error) {
    console.error('Error getting Google OAuth config:', error);
    return null;
  }
}

/**
 * Checks if Google credentials are configured
 */
export async function hasGoogleCredentials(): Promise<boolean> {
  const config = await getGoogleOAuthConfig();
  return !!config;
}
