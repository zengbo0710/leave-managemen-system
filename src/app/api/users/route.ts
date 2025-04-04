import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-utils';
import jwt, { JwtPayload } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

interface CustomJwtPayload extends JwtPayload {
  id: string;
  email: string;
  role: string;
}

// Middleware to verify admin access
async function verifyAdminAccess(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { 
      success: false, 
      response: NextResponse.json(
        { error: 'Authorization token is required' },
        { status: 401 }
      )
    };
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret') as CustomJwtPayload;
    if (decoded.role !== 'admin') {
      return { 
        success: false, 
        response: NextResponse.json(
          { error: 'Admin access required' },
          { status: 403 }
        )
      };
    }
    return { success: true };
  } catch {
    return { 
      success: false, 
      response: NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    };
  }
}

// GET all users (admin only)
export async function GET(request: NextRequest) {
  const adminVerification = await verifyAdminAccess(request);
  
  if (!adminVerification.success) {
    return adminVerification.response;
  }

  try {
    const usersResult = await query(
      'SELECT id, name, email, department, role, created_at as "createdAt" FROM users ORDER BY name',
      []
    );

    return NextResponse.json({
      success: true,
      data: usersResult.rows.map(user => ({
        ...user,
        _id: user.id.toString() // Ensure a string identifier
      }))
    });
  } catch (error: unknown) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { 
        error: 'Failed to retrieve users', 
        details: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}

// POST to create a new user (admin only)
export async function POST(request: NextRequest) {
  const adminVerification = await verifyAdminAccess(request);
  
  if (!adminVerification.success) {
    return adminVerification.response;
  }

  try {
    const { name, email, password, department, role } = await request.json();

    // Check if user exists
    const existingUserResult = await query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    if (existingUserResult.rows.length > 0) {
      return NextResponse.json(
        { error: 'User already exists with this email' },
        { status: 400 }
      );
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create user
    const result = await query(
      `INSERT INTO users (name, email, password, department, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, department, role`,
      [name, email, hashedPassword, department, role || 'employee']
    );
    
    const user = result.rows[0];
    
    return NextResponse.json(
      { success: true, data: user },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create user', 
        details: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}
