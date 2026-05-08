import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './server/database/schema';
import dotenv from 'dotenv';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is missing');
  process.exit(1);
}

const sql = neon(databaseUrl);
const db = drizzle(sql, { schema });

async function checkDb() {
  try {
    const books = await db.query.books.findMany({
      with: {
        author: true
      }
    });

    const authors = await db.query.authors.findMany();

    console.log('--- DATABASE INSPECTION ---');
    console.log(`Books count: ${books.length}`);
    console.log(`Authors count: ${authors.length}`);
    
    if (books.length > 0) {
      console.log('Latest book:', JSON.stringify(books[0], null, 2));
    } else {
      console.log('No books found in database.');
    }
  } catch (error) {
    console.error('Error checking DB:', error);
  }
}

checkDb();
