import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../lib/db';
import { sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    // Create the google_credentials table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS google_credentials (
        id SERIAL PRIMARY KEY,
        client_id TEXT NOT NULL,
        client_secret TEXT NOT NULL,
        redirect_uri TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    return NextResponse.json({
      success: true,
      message: 'Google credentials table setup completed'
    });
  } catch (error) {
    console.error('Error setting up Google credentials table:', error);
    return NextResponse.json(
      { error: 'Failed to setup Google credentials table' },
      { status: 500 }
    );
  }
}
