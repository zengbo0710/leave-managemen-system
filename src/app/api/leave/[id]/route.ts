import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Leave from '@/models/Leave';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

// GET handler for retrieving a specific leave request
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const leave = await Leave.findById(params.id)
      .populate('user', 'name email department')
      .populate('approvedBy', 'name email');
    
    if (!leave) {
      return NextResponse.json({ error: 'Leave not found' }, { status: 404 });
    }
    
    return NextResponse.json(leave);
  } catch (error) {
    console.error('Error fetching leave:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT handler for updating a leave request
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    const { id } = params;
    const data = await request.json();
    
    const leaveRequest = await Leave.findById(id);
    
    if (!leaveRequest) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404 }
      );
    }
    
    // Update leave request
    const updatedLeave = await Leave.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true }
    ).populate('user', 'name email department');
    
    return NextResponse.json(
      { success: true, data: updatedLeave },
      { status: 200 }
    );
  } catch (error: Error | unknown) {
    console.error('Error updating leave request:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update leave request';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// DELETE handler for deleting a leave request
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    const { id } = params;
    
    const leaveRequest = await Leave.findById(id);
    
    if (!leaveRequest) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404 }
      );
    }
    
    // Delete leave request
    await Leave.findByIdAndDelete(id);
    
    return NextResponse.json(
      { success: true, message: 'Leave request deleted successfully' },
      { status: 200 }
    );
  } catch (error: Error | unknown) {
    console.error('Error deleting leave request:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete leave request';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
