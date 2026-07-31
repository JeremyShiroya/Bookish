import { createError, defineEventHandler, getQuery } from 'h3';
import { enumerateSeriesWithAi } from '../../utils/aiSeriesEnumerator';

// Candidate ordering for a series, proposed by the configured language model.
//
// This is the fallback for the one question the metadata providers cannot
// answer — "what is book #31 of this series called?" — when the Goodreads
// series page is unreachable (it rate-limits devices with HTTP 202 stubs).
//
// The response is explicitly a list of CANDIDATES. The client verifies every
// proposed title against the real providers before anything is stored, so this
// endpoint never puts unverified data into a library.
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const series = query.series?.toString().trim();
  const author = query.author?.toString().trim() || undefined;

  if (!series) {
    throw createError({ statusCode: 400, statusMessage: 'A series name is required for an ordering lookup' });
  }

  // Books the client already trusts, as "16:Broken Prey|30:Masked Prey". They
  // anchor the answer: a model that cannot reproduce them is not recalling this
  // series, and its whole reply is discarded.
  const anchors: Record<number, string> = {};
  for (const pair of (query.anchors?.toString() || '').split('|')) {
    const separator = pair.indexOf(':');
    if (separator < 1) continue;
    const installment = Number(pair.slice(0, separator));
    const title = pair.slice(separator + 1).trim();
    if (Number.isSafeInteger(installment) && installment >= 1 && title) anchors[installment] = title;
  }

  const missing = (query.missing?.toString() || '')
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isSafeInteger(value) && value >= 1);

  const { books, provider, anchored } = await enumerateSeriesWithAi({
    seriesName: series,
    author,
    anchors,
    missing,
  });

  return { series, books, provider, anchored, candidatesOnly: true };
});
