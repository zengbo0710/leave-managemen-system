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

// GET a single user by ID (admin only)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    
    const adminCheck = await verifyAdminAccess(request);
    if (!adminCheck.success) {
      return adminCheck.response;
    }
    
    const user = await User.findById(params.id, { password: 0 });
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(user, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

// PUT - Update a user (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    
    const adminCheck = await verifyAdminAccess(request);
    if (!adminCheck.success) {
      return adminCheck.response;
    }
    
    const { name, email, password, role, department } = await request.json();
    
    // Find user
    const user = await User.findById(params.id);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Check if email is already in use by another user
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return NextResponse.json(
          { error: 'Email is already in use by another user' },
          { status: 409 }
        );
      }
    }
    
    // Build update object
    const updateData: any = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (password) updateData.password = await bcrypt.hash(password, 10);
    if (role) updateData.role = role;
    if (department) updateData.department = department;
    
    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      params.id,
      updateData,
      { new: true, select: '-password' }
    );
    
    return NextResponse.json(updatedUser, { status: 200 });
  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update user' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a user (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    
    const adminCheck = await verifyAdminAccess(request);
    if (!adminCheck.success) {
      return adminCheck.response;
    }
    
    // Check if user exists
    const user = await User.findById(params.id);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Don't allow deleting the last admin
    if (user.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot delete the last admin user' },
          { status: 400 }
        );
      }
    }
    
    // Delete user
    await User.findByIdAndDelete(params.id);
    
    return NextResponse.json(
      { message: 'User deleted successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete user' },
      { status: 500 }
    );
  }
}
