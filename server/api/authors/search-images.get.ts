import { defineEventHandler, getQuery, createError } from 'h3';
import { searchAuthorImagesWeb } from '../../utils/authorImagesWeb';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const name = query.name?.toString();

  if (!name) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Author name is required',
    });
  }

  return searchAuthorImagesWeb(name);
});
