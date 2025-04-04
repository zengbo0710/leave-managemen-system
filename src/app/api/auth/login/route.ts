import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db-utils';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

export async function POST(request: NextRequest) {
  // Validate JWT_SECRET first
  if (!JWT_SECRET) {
    console.error('JWT_SECRET is not defined in environment variables');
    return NextResponse.json(
      { error: 'Server configuration error: Missing JWT secret' },
      { status: 500 }
    );
  }

  try {
    // Validate email and password
    const { email, password: _ } = await request.json();
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    try {
      // Check if the user exists in the database
      const userResult = await query(
        'SELECT id, name, email, password, role, department FROM users WHERE email = $1',
        [email]
      );

      // If no user found, return error
      if (userResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Invalid email or password' },
          { status: 401 }
        );
      }

      const user = userResult.rows[0];

      // Verify password
      const isPasswordValid = await bcrypt.compare(_, user.password);
      
      if (!isPasswordValid) {
        return NextResponse.json(
          { error: 'Invalid email or password' },
          { status: 401 }
        );
      }

      // Create JWT token (now guaranteed to have a non-null secret)
      const token = jwt.sign(
        { 
          id: user.id, 
          email: user.email,
          role: user.role,
          name: user.name,
          department: user.department
        },
        JWT_SECRET as string,  // Type assertion to ensure non-null
        { expiresIn: '1d' }
      );
      
      // Remove password from user object before sending
      const { password, ...userWithoutPassword } = user;
      
      // Format response to match what AuthContext expects
      return NextResponse.json({
        success: true,
        token,
        user: userWithoutPassword,
        // Include data field for backward compatibility
        data: userWithoutPassword
      });
      
    } catch (error: unknown) {
      console.error('Error logging in:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return NextResponse.json(
        { error: 'Login failed', details: errorMessage },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    console.error('Error processing login request:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Login request processing failed', details: errorMessage },
      { status: 500 }
    );
  }
}
