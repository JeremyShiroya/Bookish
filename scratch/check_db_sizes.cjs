const { neon } = require('@neondatabase/serverless');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkData() {
  const sql = neon(process.env.DATABASE_URL);
  
  try {
    console.log('Fetching book sizes...');
    const books = await sql`
      SELECT id, title, length(cover) as cover_len, length(content) as content_len 
      FROM books 
      ORDER BY (COALESCE(length(cover), 0) + COALESCE(length(content), 0)) DESC
    `;
    
    console.log('Book Sizes Summary:');
    books.forEach(b => {
      console.log(`ID: ${b.id} | Title: ${b.title} | Cover: ${b.cover_len || 0} chars | Content: ${b.content_len || 0} chars`);
    });

    const totalCover = books.reduce((acc, b) => acc + (b.cover_len || 0), 0);
    const totalContent = books.reduce((acc, b) => acc + (b.content_len || 0), 0);
    
    console.log('\nTotals:');
    console.log(`Total Books: ${books.length}`);
    console.log(`Total Cover Size: ${totalCover} chars`);
    console.log(`Total Content Size: ${totalContent} chars`);
    
  } catch (err) {
    console.error('Error fetching data:', err);
  }
}

checkData();
