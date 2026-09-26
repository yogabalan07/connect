const MENTION_PATTERN = /@([A-Za-z0-9_]{2,32})/g;

/**
 * Extracts @handles from a piece of content.
 * Results are stored on documents as `mentions[]` so the backend can later
 * fan out mention notifications without re-parsing text.
 */
export function extractMentions(text: string): string[] {
  if (!text) return [];
  const found = new Set<string>();
  for (const match of text.matchAll(MENTION_PATTERN)) {
    found.add(match[1]);
    if (found.size >= 10) break;
  }
  return Array.from(found);
}
