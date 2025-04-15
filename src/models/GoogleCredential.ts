import mongoose, { Schema, Document } from 'mongoose';

// Define the interface for Google OAuth credentials
export interface IGoogleCredential extends Document {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  createdAt: Date;
  updatedAt: Date;
}

// Create the schema for Google OAuth credentials
const GoogleCredentialSchema: Schema = new Schema(
  {
    clientId: {
      type: String,
      required: true,
      trim: true,
    },
    clientSecret: {
      type: String,
      required: true,
      trim: true,
    },
    redirectUri: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true, // Automatically add createdAt and updatedAt fields
  }
);

// Export the model or create it if it doesn't exist
export default mongoose.models.GoogleCredential || 
  mongoose.model<IGoogleCredential>('GoogleCredential', GoogleCredentialSchema);
