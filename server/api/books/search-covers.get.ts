import { defineEventHandler, getQuery, createError } from 'h3';
import { searchBookCovers } from '../../utils/coverSearch';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const title = query.title?.toString();
  const author = query.author?.toString();
  const publisher = query.publisher?.toString();

  if (!title) {
    throw createError({ statusCode: 400, statusMessage: 'Title is required for cover search' });
  }

  return searchBookCovers(title, author, publisher);
});
