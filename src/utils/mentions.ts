const MENTION_PATTERN = /@([A-Za-z0-9_]{2,32})/g;

/** Ceiling on how many distinct people one body may address. */
export const MAX_MENTIONS = 10;

/** The only user facts mention resolution is allowed to look at. */
export interface MentionCandidate {
  id: string;
  username: string;
}

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
    if (found.size >= MAX_MENTIONS) break;
  }
  return Array.from(found);
}

/**
 * Resolves extracted handles to Firebase UIDs against the loaded directory.
 *
 * A handle that matches nobody is dropped rather than passed through: the
 * returned IDs are what `mentionIds[]` persists and what the notification
 * fan-out uses, so an attacker cannot address a user by inventing a handle
 * and cannot smuggle an arbitrary UID in as a "mention".
 *
 * Matching is case-insensitive because `@Priya` and `@priya` are the same
 * person to a human; the directory lookup is what makes them the same
 * person to the system.
 */
export function resolveMentions(handles: string[], candidates: MentionCandidate[]): string[] {
  if (handles.length === 0 || candidates.length === 0) return [];

  const byHandle = new Map<string, string>();
  for (const candidate of candidates) {
    const key = candidate.username.trim().toLowerCase();
    if (key && !byHandle.has(key)) byHandle.set(key, candidate.id);
  }

  const resolved: string[] = [];
  const seen = new Set<string>();
  for (const handle of handles) {
    const id = byHandle.get(handle.trim().toLowerCase());
    if (!id || seen.has(id)) continue;
    seen.add(id);
    resolved.push(id);
    if (resolved.length >= MAX_MENTIONS) break;
  }
  return resolved;
}

/**
 * One pass over a body: the handles to store on the document (`mentions[]`)
 * and the UIDs to store alongside them (`mentionIds[]`).
 *
 * Callers need both - the raw handles keep the original casing for display,
 * the resolved IDs are what the notification fan-out may address - so doing
 * the two steps together keeps them from drifting apart.
 */
export function mentionsFor(
  text: string,
  candidates: MentionCandidate[]
): { handles: string[]; ids: string[] } {
  const handles = extractMentions(text);
  return { handles, ids: resolveMentions(handles, candidates) };
}
