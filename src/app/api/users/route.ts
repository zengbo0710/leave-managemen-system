import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
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
    await connectToDatabase();
    
    const adminCheck = await verifyAdminAccess(request);
    if (!adminCheck.success) {
      return adminCheck.response;
    }
    
    // Get users, excluding password field
    const users = await User.find({}, { password: 0 }).sort({ createdAt: -1 });
    
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
    await connectToDatabase();
    
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
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create new user
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || 'employee', // Default to employee if not specified
      department,
    });
    
    // Return user without password
    const userResponse = {
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      department: newUser.department,
      createdAt: newUser.createdAt,
      updatedAt: newUser.updatedAt
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
