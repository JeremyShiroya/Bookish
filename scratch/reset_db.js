import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

async function resetDb() {
  const sql = neon(process.env.DATABASE_URL);
  
  console.log('Dropping existing tables...');
  try {
    // Drop all tables in public schema
    await sql`DROP TABLE IF EXISTS collections_to_books CASCADE`;
    await sql`DROP TABLE IF EXISTS books_to_genres CASCADE`;
    await sql`DROP TABLE IF EXISTS collections CASCADE`;
    await sql`DROP TABLE IF EXISTS books CASCADE`;
    await sql`DROP TABLE IF EXISTS authors CASCADE`;
    await sql`DROP TABLE IF EXISTS genres CASCADE`;
    await sql`DROP TABLE IF EXISTS __drizzle_migrations CASCADE`;
    console.log('Database reset successful.');
  } catch (error) {
    console.error('Failed to reset database:', error);
  }
}

resetDb();
