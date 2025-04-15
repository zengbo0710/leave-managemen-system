import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { 
  saveGoogleCredentials, 
  getGoogleCredentials, 
  deleteGoogleCredentials 
} from '../../../../../services/googleCredentialService';

// Verify admin authentication
async function isAdmin(request: NextRequest): Promise<boolean> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return false;
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key') as any;
    
    return decoded.role === 'admin';
  } catch (error) {
    console.error('Auth error:', error);
    return false;
  }
}

// Get Google OAuth credentials
export async function GET(request: NextRequest) {
  try {
    // Verify admin authorization
    if (!await isAdmin(request)) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const credentials = await getGoogleCredentials();
    
    if (!credentials) {
      return NextResponse.json(
        { error: 'No Google credentials found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      clientId: credentials.clientId,
      redirectUri: credentials.redirectUri,
      // Don't return the client secret directly for security reasons
      hasClientSecret: !!credentials.clientSecret
    });
  } catch (error) {
    console.error('Error retrieving Google credentials:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve Google credentials' },
      { status: 500 }
    );
  }
}

// Save/update Google credentials
export async function POST(request: NextRequest) {
  try {
    // Verify admin authorization
    if (!await isAdmin(request)) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    
    // Validate required fields
    if (!body.clientId || !body.clientSecret) {
      return NextResponse.json(
        { error: 'Missing required fields: clientId, clientSecret' },
        { status: 400 }
      );
    }

    // Get redirect URI or use default
    const redirectUri = body.redirectUri || process.env.GOOGLE_REDIRECT_URI || 
      'https://developers.google.com/oauthplayground';

    // Save credentials
    await saveGoogleCredentials({
      clientId: body.clientId,
      clientSecret: body.clientSecret,
      redirectUri: redirectUri
    });

    return NextResponse.json({
      success: true,
      message: 'Google OAuth credentials saved successfully'
    });
  } catch (error) {
    console.error('Error saving Google credentials:', error);
    return NextResponse.json(
      { error: 'Failed to save Google credentials' },
      { status: 500 }
    );
  }
}

// Delete Google credentials
export async function DELETE(request: NextRequest) {
  try {
    // Verify admin authorization
    if (!await isAdmin(request)) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const deleted = await deleteGoogleCredentials();
    
    if (!deleted) {
      return NextResponse.json(
        { error: 'No Google credentials found to delete' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Google OAuth credentials deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting Google credentials:', error);
    return NextResponse.json(
      { error: 'Failed to delete Google credentials' },
      { status: 500 }
    );
  }
}
