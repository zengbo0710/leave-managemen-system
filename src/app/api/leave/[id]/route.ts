import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Leave from '@/models/Leave';
import { getServerSession } from 'next-auth/next';
import { AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { query } from '@/lib/db-utils';
import bcrypt from 'bcryptjs';

// Define authOptions locally
const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          // Check user in database
          const userResult = await query(
            'SELECT id, name, email, password, role, department FROM users WHERE email = $1',
            [credentials.email]
          );

          // If no user found
          if (userResult.rows.length === 0) {
            return null;
          }

          const user = userResult.rows[0];

          // Check password
          const isPasswordValid = await bcrypt.compare(
            credentials.password, 
            user.password
          );

          if (!isPasswordValid) {
            return null;
          }

          // Return user object for session
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            department: user.department
          };
        } catch (error) {
          console.error('Authentication error:', error);
          return null;
        }
      }
    })
  ],
  callbacks: {
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub || '';
        session.user.role = token.role;
        session.user.department = token.department;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.department = user.department;
      }
      return token;
    }
  }
};

// GET handler for retrieving a specific leave request
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function GET(
  request: NextRequest,
  context: any
) {
  try {
    await dbConnect();
    
    const session = await getServerSession({ 
      providers: authOptions.providers,
      callbacks: authOptions.callbacks 
    });
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const leave = await Leave.findById(context.params.id)
      .populate('user', 'name email department')
      .populate('approvedBy', 'name email');
    
    if (!leave) {
      return NextResponse.json({ error: 'Leave not found' }, { status: 404 });
    }
    
    return NextResponse.json({
      ...leave.toObject(),
      _id: leave._id.toString(), // Ensure string identifier
      user: {
        name: leave.user?.name,
        department: leave.user?.department
      }
    });
  } catch (error) {
    console.error('Error fetching leave:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT handler for updating a leave request
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function PUT(
  request: NextRequest,
  context: any
) {
  try {
    await dbConnect();
    const { id } = context.params;
    const data = await request.json();
    
    const leaveRequest = await Leave.findById(id);
    
    if (!leaveRequest) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404 }
      );
    }
    
    // Add additional update logic here
    
    return NextResponse.json(leaveRequest);
  } catch (error) {
    console.error('Error updating leave:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE handler for deleting a leave request
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function DELETE(
  request: NextRequest,
  context: any
) {
  try {
    await dbConnect();
    const { id } = context.params;
    
    const leaveRequest = await Leave.findById(id);
    
    if (!leaveRequest) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404 }
      );
    }
    
    await Leave.findByIdAndDelete(id);
    
    return NextResponse.json(
      { success: true, message: 'Leave request deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting leave request:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
