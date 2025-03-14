import mongoose, { Schema, Document } from 'mongoose';
import { IUser } from './User';

export interface ILeave extends Document {
  user: IUser['_id'];
  startDate: Date;
  endDate: Date;
  leaveType: 'annual' | 'sick' | 'personal' | 'other';
  halfDay: {
    isHalfDay: boolean;
    period: 'morning' | 'afternoon' | null;
  };
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: IUser['_id'];
  slackNotificationSent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const LeaveSchema: Schema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    leaveType: { 
      type: String, 
      enum: ['annual', 'sick', 'personal', 'other'], 
      required: true 
    },
    halfDay: {
      isHalfDay: { type: Boolean, default: false },
      period: { 
        type: String, 
        enum: ['morning', 'afternoon', null], 
        default: null 
      }
    },
    reason: { type: String, required: true },
    status: { 
      type: String, 
      enum: ['pending', 'approved', 'rejected'], 
      default: 'pending' 
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    slackNotificationSent: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export default mongoose.models.Leave || mongoose.model<ILeave>('Leave', LeaveSchema);
