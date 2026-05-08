import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './server/database/schema';
import dotenv from 'dotenv';
import { sql as drizzleSql } from 'drizzle-orm';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  process.exit(1);
}

const sql = neon(databaseUrl);
const db = drizzle(sql, { schema });

async function checkContent() {
  try {
    const result = await db.select({
      id: schema.books.id,
      title: schema.books.title,
      contentLength: drizzleSql<number>`length(${schema.books.content})`
    }).from(schema.books);

    console.log('--- CONTENT SIZE CHECK ---');
    console.table(result);
    
    const totalSize = result.reduce((acc, curr) => acc + (curr.contentLength || 0), 0);
    console.log(`Total content size: ${totalSize} chars`);
  } catch (error) {
    console.error('Error checking content size:', error);
  }
}

checkContent();
