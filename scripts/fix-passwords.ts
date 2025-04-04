import { query } from '../src/lib/db-utils';
import bcrypt from 'bcryptjs';

async function fixPasswords() {
  try {
    console.log('Updating user passwords...');
    
    // Generate new correct password hashes
    const adminPasswordHash = await bcrypt.hash('admin123', 10);
    const employeePasswordHash = await bcrypt.hash('employee123', 10);
    
    // Update admin password
    const adminResult = await query(
      'UPDATE users SET password = $1 WHERE email = $2 RETURNING id, name, email',
      [adminPasswordHash, 'admin@example.com']
    );
    
    if (adminResult.rows.length > 0) {
      console.log('Updated password for admin user:', adminResult.rows[0].email);
    } else {
      console.log('Admin user not found');
    }
    
    // Update employee passwords
    const johnResult = await query(
      'UPDATE users SET password = $1 WHERE email = $2 RETURNING id, name, email',
      [employeePasswordHash, 'john@example.com']
    );
    
    if (johnResult.rows.length > 0) {
      console.log('Updated password for employee:', johnResult.rows[0].email);
    }
    
    const sarahResult = await query(
      'UPDATE users SET password = $1 WHERE email = $2 RETURNING id, name, email',
      [employeePasswordHash, 'sarah@example.com']
    );
    
    if (sarahResult.rows.length > 0) {
      console.log('Updated password for employee:', sarahResult.rows[0].email);
    }
    
    console.log('Password update completed.');
  } catch (error) {
    console.error('Error updating passwords:', error);
  }
}

// Run the password fix function
fixPasswords();
