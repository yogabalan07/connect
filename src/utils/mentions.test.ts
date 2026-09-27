import { describe, expect, it } from 'vitest';
import { MAX_MENTIONS, extractMentions, mentionsFor, resolveMentions } from './mentions';
import type { MentionCandidate } from './mentions';

/**
 * Mentions are the one place a piece of text turns into a write against
 * somebody else's inbox, so both halves are pinned: what we store on the
 * document (`mentions[]` for display) and what we are allowed to address
 * (`mentionIds[]`, only ever UIDs that a real handle resolved to).
 */
const directory: MentionCandidate[] = [
  { id: 'uid_priya', username: 'priya' },
  { id: 'uid_arun', username: 'Arun_K' },
  { id: 'uid_sam', username: 'sam' }
];

describe('extractMentions', () => {
  it('collects distinct handles in the order they appear', () => {
    expect(extractMentions('ping @priya and @Arun_K, thanks @priya')).toEqual(['priya', 'Arun_K']);
  });

  it('ignores punctuation and too-short handles', () => {
    expect(extractMentions('ping @a, @b, @. and @?')).toEqual([]);
    expect(extractMentions('take 2: @v2 ships now')).toEqual(['v2']);
  });

  it('never extracts more than the documented ceiling', () => {
    const text = Array.from({ length: MAX_MENTIONS + 5 }, (_, i) => `@user${i}`).join(' ');
    expect(extractMentions(text)).toHaveLength(MAX_MENTIONS);
  });

  it('returns an empty list for empty input', () => {
    expect(extractMentions('')).toEqual([]);
  });
});

describe('resolveMentions', () => {
  it('maps handles to UIDs case-insensitively', () => {
    expect(resolveMentions(['PRIYA', 'arun_k'], directory)).toEqual(['uid_priya', 'uid_arun']);
  });

  it('drops handles nobody answers to', () => {
    expect(resolveMentions(['priya', 'ghost', 'nobodyhere'], directory)).toEqual(['uid_priya']);
  });

  it('collapses two handles that resolve to the same person', () => {
    expect(resolveMentions(['priya', 'PRIYA'], directory)).toEqual(['uid_priya']);
  });

  it('caps the fan-out at the documented ceiling', () => {
    const crowd: MentionCandidate[] = Array.from({ length: MAX_MENTIONS + 5 }, (_, i) => ({
      id: `uid_user${i}`,
      username: `user${i}`
    }));

    expect(resolveMentions(crowd.map(c => c.username), crowd)).toHaveLength(MAX_MENTIONS);
  });

  it('refuses to resolve anything when the directory is unavailable', () => {
    expect(resolveMentions(['priya'], [])).toEqual([]);
  });
});

describe('mentionsFor', () => {
  it('returns the display handles and the resolved UIDs from one pass', () => {
    const result = mentionsFor('cc @Priya and @arun_K plus @ghost', directory);

    expect(result.handles).toEqual(['Priya', 'arun_K', 'ghost']);
    expect(result.ids).toEqual(['uid_priya', 'uid_arun']);
  });

  it('stays empty for a body that mentions nobody', () => {
    expect(mentionsFor('just a question', directory)).toEqual({ handles: [], ids: [] });
  });
});
