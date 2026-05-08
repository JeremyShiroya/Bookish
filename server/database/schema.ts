import { pgTable, serial, text, integer, boolean, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Authors Table
export const authors = pgTable('authors', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const authorsRelations = relations(authors, ({ many }) => ({
  books: many(books),
}));

// Genres Table
export const genres = pgTable('genres', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const genresRelations = relations(genres, ({ many }) => ({
  books: many(booksToGenres),
}));

// Collections Table
export const collections = pgTable('collections', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  cover: text('cover'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const collectionsRelations = relations(collections, ({ many }) => ({
  books: many(collectionsToBooks),
}));

// Books Table (Normalized with Author FK)
export const books = pgTable('books', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  authorId: integer('author_id').references(() => authors.id, { onDelete: 'set null' }),
  cover: text('cover'),
  series: text('series'),
  seriesInstallment: text('series_installment'),
  blurb: text('blurb'),
  publishYear: integer('publish_year'),
  webReview: text('web_review'),
  progress: integer('progress').default(0),
  rating: integer('rating').default(0),
  format: text('format'),
  pages: integer('pages').default(0),
  status: text('status').default('Unread'),
  isFavourite: boolean('is_favourite').default(false),
  content: text('content'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const booksRelations = relations(books, ({ one, many }) => ({
  author: one(authors, {
    fields: [books.authorId],
    references: [authors.id],
  }),
  genres: many(booksToGenres),
  collections: many(collectionsToBooks),
}));

// Junction: Books <-> Genres (Many-to-Many)
export const booksToGenres = pgTable('books_to_genres', {
  bookId: integer('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  genreId: integer('genre_id').notNull().references(() => genres.id, { onDelete: 'cascade' }),
}, (t) => ({
  pk: primaryKey({ columns: [t.bookId, t.genreId] }),
}));

export const booksToGenresRelations = relations(booksToGenres, ({ one }) => ({
  book: one(books, {
    fields: [booksToGenres.bookId],
    references: [books.id],
  }),
  genre: one(genres, {
    fields: [booksToGenres.genreId],
    references: [genres.id],
  }),
}));

// Junction: Collections <-> Books (Many-to-Many)
export const collectionsToBooks = pgTable('collections_to_books', {
  collectionId: integer('collection_id').notNull().references(() => collections.id, { onDelete: 'cascade' }),
  bookId: integer('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  addedAt: timestamp('added_at').defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.collectionId, t.bookId] }),
}));

export const collectionsToBooksRelations = relations(collectionsToBooks, ({ one }) => ({
  collection: one(collections, {
    fields: [collectionsToBooks.collectionId],
    references: [collections.id],
  }),
  book: one(books, {
    fields: [collectionsToBooks.bookId],
    references: [books.id],
  }),
}));

