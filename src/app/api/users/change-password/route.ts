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

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    // Extract the token from the Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization token is required' },
        { status: 401 }
      );
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify the token and extract user ID
    let decoded: CustomJwtPayload;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret') as CustomJwtPayload;
    } catch {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }
    
    const userId = decoded.id;
    const { currentPassword, newPassword } = await request.json();
    
    // Validate input
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current password and new password are required' },
        { status: 400 }
      );
    }
    
    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Validate current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      );
    }
    
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update the user's password
    await User.findByIdAndUpdate(userId, { password: hashedPassword });
    
    return NextResponse.json(
      { message: 'Password updated successfully' },
      { status: 200 }
    );
  } catch (error: Error | unknown) {
    console.error('Error changing password:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to change password';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
