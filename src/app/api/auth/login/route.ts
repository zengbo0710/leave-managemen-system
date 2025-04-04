import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-utils';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    console.log('Login attempt for email:', email);
    
    // Check if user exists
    const result = await query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    const user = result.rows[0];
    if (!user) {
      console.log('User not found with email:', email);
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }
    
    // Verify password
    console.log('Verifying password for user:', user.email);
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('Password match result:', isMatch);
    
    if (!isMatch) {
      console.log('Password verification failed for user:', user.email);
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }
    
    // Create JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '7d' }
    );
    
    // User data to return (without password)
    const userData = {
      _id: user.id, // Map PostgreSQL id to _id for frontend compatibility
      name: user.name,
      email: user.email,
      department: user.department,
      role: user.role
    };
    
    console.log('Login successful for user:', user.email);
    console.log('Generated token:', token);
    console.log('Sending response with userData:', userData);
    
    // Create response object
    const responseObj = { success: true, data: userData, token };
    console.log('Full response object:', responseObj);
    
    return NextResponse.json(responseObj, { status: 200 });
  } catch (error: any) {
    console.error('Error logging in:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to log in' },
      { status: 500 }
    );
  }
}
