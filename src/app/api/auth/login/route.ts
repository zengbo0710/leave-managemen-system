import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db-utils';
import jwt from 'jsonwebtoken';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    
    console.log(`Login attempt for email: ${email}`);
    
    // Input validation
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    try {
      // Query for the user with email
      const result = await query(
        'SELECT id, name, email, password, role, department FROM users WHERE email = $1',
        [email]
      );

      // Check if user exists
      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Invalid email or password' },
          { status: 401 }
        );
      }

      const user = result.rows[0];
      
      // Compare passwords
      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (!isPasswordValid) {
        return NextResponse.json(
          { error: 'Invalid email or password' },
          { status: 401 }
        );
      }
      
      // Create JWT token
      const JWT_SECRET = process.env.JWT_SECRET;
      if (!JWT_SECRET) {
        console.error('JWT_SECRET is not defined in environment variables');
        return NextResponse.json(
          { error: 'Server configuration error' },
          { status: 500 }
        );
      }

      // Remove password from user object before creating token
      const { password: _, ...userWithoutPassword } = user;
      
      const token = jwt.sign(
        { 
          id: user.id, 
          email: user.email,
          role: user.role,
          name: user.name,
          department: user.department
        },
        JWT_SECRET,
        { expiresIn: '1d' }
      );
      
      return NextResponse.json({
        token,
        user: userWithoutPassword
      });
      
    } catch (dbError: any) {
      console.error('Database error during login:', dbError);
      return NextResponse.json(
        { error: 'Database error', details: dbError.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error logging in:', error);
    return NextResponse.json(
      { error: 'Login failed', details: error.message },
      { status: 500 }
    );
  }
}
