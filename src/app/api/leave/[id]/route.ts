import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Leave from '@/models/Leave';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    const { id } = params;
    
    const leaveRequest = await Leave.findById(id).populate('user', 'name email department');
    
    if (!leaveRequest) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { success: true, data: leaveRequest },
      { status: 200 }
    );
  } catch (error: Error | unknown) {
    console.error('Error fetching leave request:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch leave request';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
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
