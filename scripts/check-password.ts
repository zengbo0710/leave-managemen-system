import { query } from '../src/lib/db-utils';
import bcrypt from 'bcryptjs';

async function checkPassword() {
  try {
    console.log('Checking password hashes in database...');
    
    // Query the admin user's password hash
    const adminResult = await query(
      'SELECT id, name, email, password FROM users WHERE email = $1',
      ['admin@example.com']
    );
    
    if (adminResult.rows.length === 0) {
      console.log('Admin user not found!');
      return;
    }
    
    const admin = adminResult.rows[0];
    console.log('Admin user found:', admin.email);
    console.log('Password hash:', admin.password);
    
    // Try comparing with the expected password
    const passwordToCheck = 'admin123';
    const isMatch = await bcrypt.compare(passwordToCheck, admin.password);
    console.log(`Password "${passwordToCheck}" matches: ${isMatch}`);
    
    // Generate a new hash for comparison
    const newHash = await bcrypt.hash(passwordToCheck, 10);
    console.log('Newly generated hash:', newHash);
    
    // This will help us identify if there's a version mismatch between bcrypt hashes
    console.log('Hash prefix comparison:');
    console.log(`Stored hash prefix: ${admin.password.substring(0, 7)}`);
    console.log(`New hash prefix: ${newHash.substring(0, 7)}`);
    
  } catch (error) {
    console.error('Error checking passwords:', error);
  }
}

// Run the check function
checkPassword();
