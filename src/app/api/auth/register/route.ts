import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    console.log('Starting registration process');
    await connectToDatabase();
    console.log('DB connection successful');
    const { name, email, password, department } = await request.json();
    console.log('Received registration data:', { name, email, department });
    
    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists with this email' },
        { status: 400 }
      );
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      department,
      role: 'employee' // Default role
    });
    
    // Remove password from response
    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      department: user.department,
      role: user.role
    };
    
    return NextResponse.json(
      { success: true, data: userResponse },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error registering user:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { error: error.message || 'Failed to register user' },
      { status: 500 }
    );
  }
}
