import { db } from './src/db';
import { sql } from 'drizzle-orm';

async function testConnection() {
  try {
    const result = await db.execute(sql`SELECT NOW()`);
    console.log('Database connected:', result);
    
    // Check if tables exist
    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('Tables:', tables);
  } catch (error) {
    console.error('Database error:', error);
  }
}

testConnection();
