import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-utils';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    console.log('Starting registration process');
    const { name, email, password, department } = await request.json();
    console.log('Received registration data:', { name, email, department });
    
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
      [name, email, hashedPassword, department, 'employee'] // Default role as employee
    );
    
    const user = result.rows[0];
    
    // Format response for frontend compatibility
    const userResponse = {
      _id: user.id, // Map PostgreSQL id to _id for frontend compatibility
      name: user.name,
      email: user.email,
      department: user.department,
      role: user.role
    };
    
    return NextResponse.json(
      { success: true, data: userResponse },
      { status: 201 }
    );
  } catch (error: Error | unknown) {
    console.error('Error registering user:', error);
    
    // Only log stack trace if it's an Error object
    if (error instanceof Error) {
      console.error('Error stack:', error.stack);
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to register user';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
