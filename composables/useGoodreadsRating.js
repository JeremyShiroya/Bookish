export const parseGoodreadsReview = (webReview) => {
  const text = String(webReview || '');
  const ratingMatch =
    text.match(/Goodreads\s+Rating:\s*([\d.]+)/i)
    || text.match(/\bRating:\s*([\d.]+)/i)
    || text.match(/\b([\d.]+)\s*\/\s*5\b/i);

  const rating = ratingMatch ? Number.parseFloat(ratingMatch[1]) : 0;
  const ratingsMatch = text.match(/([\d,]+)\s+ratings?/i);
  const reviewsMatch = text.match(/([\d,]+)\s+reviews?/i);
  const basedOnMatch = text.match(/based on\s+([\d,]+)/i);
  const fallbackCount = basedOnMatch && !ratingsMatch && !reviewsMatch ? basedOnMatch[1] : null;

  return {
    rating: Number.isFinite(rating) ? rating : 0,
    ratingsCount: ratingsMatch?.[1] || fallbackCount,
    reviewsCount: reviewsMatch?.[1] || null,
    hasRating: Number.isFinite(rating) && rating > 0,
  };
};

export const getGoodreadsRating = (bookOrReview) => {
  const webReview = typeof bookOrReview === 'string'
    ? bookOrReview
    : bookOrReview?.webReview;
  return parseGoodreadsReview(webReview).rating;
};
