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
    return { success: true, userId: decoded.id };
  } catch (error) {
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
  try {
    const adminCheck = await verifyAdminAccess(request);
    if (!adminCheck.success) {
      return adminCheck.response;
    }
    
    // Get users, excluding password field
    const result = await query(
      `SELECT id, name, email, role, department, created_at, updated_at 
       FROM users 
       ORDER BY created_at DESC`,
      []
    );
    
    // Format users for frontend compatibility
    const users = result.rows.map(user => ({
      _id: user.id, // Map id to _id for frontend compatibility
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    }));
    
    return NextResponse.json(users, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// POST - Create a new user (admin only)
export async function POST(request: NextRequest) {
  try {
    const adminCheck = await verifyAdminAccess(request);
    if (!adminCheck.success) {
      return adminCheck.response;
    }
    
    const { name, email, password, role, department } = await request.json();
    
    // Validate required fields
    if (!name || !email || !password || !department) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Check if user already exists
    const existingUserResult = await query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    if (existingUserResult.rows.length > 0) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create new user
    const userRole = role || 'employee'; // Default to employee if not specified
    const newUserResult = await query(
      `INSERT INTO users (name, email, password, role, department)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, department, created_at, updated_at`,
      [name, email, hashedPassword, userRole, department]
    );
    
    const newUser = newUserResult.rows[0];
    
    // Format response for frontend compatibility
    const userResponse = {
      _id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      department: newUser.department,
      createdAt: newUser.created_at,
      updatedAt: newUser.updated_at
    };
    
    return NextResponse.json(
      { success: true, data: userResponse },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create user' },
      { status: 500 }
    );
  }
}
