import { BadgeDefinition, UserBadge } from '../types';
import { ServiceError } from '../lib/errors';
import { getServiceActor } from './actor';
import { getContentAdapter } from './contentAdapter';
import type { UserBadgeDraft } from './contentAdapter';
import { mapFirestoreError } from './firestoreErrors';
import { notificationService } from './notificationService';
import { userService } from './userService';

/**
 * Badges - what a member has actually proved they earned.
 *
 * Layering: UI -> context -> THIS file -> content adapter -> Firestore.
 *
 * Two kinds, and the split is forced by the technology rather than taste:
 *
 * - `self` badges (`first_doubt`, `first_answer`, `first_accepted`,
 *   `first_comment`) name a document that already proves the milestone, so
 *   `firestore.rules` can re-read it and award the badge to its author.
 *   Anybody can claim the badge they plainly earned, and only theirs.
 * - `threshold` badges need a *count*, which rules cannot take. They are
 *   therefore moderator-only by construction: a `threshold` row can only be
 *   written by a signed-in admin claiming it for themselves. Gifting one to
 *   another member is refused by the rules and is reported as such rather
 *   than faked.
 *
 * The badge ids are hard-coded in `firestore.rules` (`knownBadge()`), so
 * this catalogue - and any document seeded from it - can never invent an id
 * the rules will not accept.
 */
export const DEFAULT_BADGES: BadgeDefinition[] = [
  {
    id: 'first_doubt',
    name: 'First Question',
    description: 'Asked your first question on Connect.',
    icon: 'seedling',
    tier: 'bronze',
    kind: 'self'
  },
  {
    id: 'first_answer',
    name: 'First Answer',
    description: 'Posted your first answer on Connect.',
    icon: 'lightbulb',
    tier: 'bronze',
    kind: 'self'
  },
  {
    id: 'first_comment',
    name: 'First Comment',
    description: 'Joined a discussion with your first comment.',
    icon: 'message',
    tier: 'bronze',
    kind: 'self'
  },
  {
    id: 'first_accepted',
    name: 'Accepted Solution',
    description: 'Had an answer marked as the accepted solution.',
    icon: 'check',
    tier: 'silver',
    kind: 'self'
  },
  {
    id: 'helpful_contributor',
    name: 'Helpful Contributor',
    description: 'Reached 250 reputation by helping the campus.',
    icon: 'hand',
    tier: 'silver',
    kind: 'threshold',
    threshold: 250
  },
  {
    id: 'active_contributor',
    name: 'Active Contributor',
    description: 'Reached 1000 reputation through steady contribution.',
    icon: 'flame',
    tier: 'gold',
    kind: 'threshold',
    threshold: 1000
  },
  {
    id: 'top_contributor',
    name: 'Top Contributor',
    description: 'Reached 2500 reputation as a leading campus voice.',
    icon: 'trophy',
    tier: 'diamond',
    kind: 'threshold',
    threshold: 2500
  }
];

let catalogue: BadgeDefinition[] | null = null;

/**
 * The badge catalogue.
 *
 * Reads Firestore first so a moderator can reword or retire a badge, and
 * falls back to the source list when the collection has not been seeded -
 * an unseeded catalogue must never render an empty profile.
 */
export async function listBadgeDefinitions(): Promise<BadgeDefinition[]> {
  if (catalogue) return catalogue;
  try {
    const remote = await getContentAdapter().listBadgeDefinitions();
    catalogue = remote.length > 0 ? remote : DEFAULT_BADGES;
  } catch {
    catalogue = DEFAULT_BADGES;
  }
  return catalogue;
}

/** Badges a member really holds, newest first. */
export async function listUserBadges(uid: string): Promise<UserBadge[]> {
  try {
    return await getContentAdapter().listUserBadges(uid);
  } catch (error) {
    throw mapFirestoreError(error);
  }
}

function definitionFor(badgeId: string): BadgeDefinition | undefined {
  return DEFAULT_BADGES.find(badge => badge.id === badgeId);
}

async function notifyAward(uid: string, badgeId: string): Promise<void> {
  const holder = userService.getById(uid);
  const definition = definitionFor(badgeId);
  if (!holder || !definition) return;
  try {
    await notificationService.notifyBadgeEarned(
      uid,
      { id: holder.id, name: holder.name, avatar: holder.avatar },
      definition.name,
      badgeId
    );
  } catch {
    /* the badge is held either way */
  }
}

/**
 * Claims a `self` badge the caller plainly earned.
 *
 * Returns the persisted row, or `null` when it was already held - the
 * deterministic `userBadges/{uid}_{badgeId}` id makes that the expected
 * outcome of any second attempt, not an error.
 */
async function claimSelfBadge(draft: UserBadgeDraft): Promise<UserBadge | null> {
  try {
    const badge = await getContentAdapter().createUserBadge(draft);
    await notifyAward(draft.uid, draft.badgeId);
    return badge;
  } catch (error) {
    const mapped = mapFirestoreError(error);
    if (mapped.code === 'content/exists') return null;
    throw mapped;
  }
}

/** Claimed the first time you post a question. */
export function claimFirstDoubt(doubtId: string, uid: string): Promise<UserBadge | null> {
  return claimSelfBadge({ badgeId: 'first_doubt', uid, sourceId: doubtId });
}

/** Claimed the first time you post an answer. */
export function claimFirstAnswer(
  uid: string,
  doubtId: string,
  answerId: string
): Promise<UserBadge | null> {
  return claimSelfBadge({ badgeId: 'first_answer', uid, sourceId: answerId, doubtId });
}

/** Claimed the first time one of your answers is accepted. */
export function claimFirstAccepted(
  uid: string,
  reputationEventId: string
): Promise<UserBadge | null> {
  return claimSelfBadge({ badgeId: 'first_accepted', uid, sourceId: reputationEventId });
}

/** Claimed the first time you comment on a question. */
export function claimFirstComment(
  uid: string,
  doubtId: string,
  commentId: string
): Promise<UserBadge | null> {
  return claimSelfBadge({ badgeId: 'first_comment', uid, sourceId: commentId, doubtId });
}

/**
 * Claims a `threshold` badge for the signed-in moderator.
 *
 * Firestore rules cannot count, so they refuse every non-admin writer of a
 * `threshold` row - and they also pin the row to the caller's own uid. That
 * is why this only ever targets the caller, and why the client refuses
 * before spending a request when the caller is not an admin.
 */
export async function claimThresholdBadge(badgeId: string): Promise<UserBadge | null> {
  const definition = definitionFor(badgeId);
  const uid = getServiceActor();
  const caller = uid ? userService.getById(uid) : undefined;
  if (!definition || definition.kind !== 'threshold') {
    throw new ServiceError('badge/unknown', 'That badge is not part of this catalogue.');
  }
  if (!caller || caller.role !== 'admin') {
    throw new ServiceError('badge/forbidden', 'Only a moderator can grant a threshold badge.');
  }
  try {
    const badge = await getContentAdapter().createUserBadge({
      badgeId,
      uid: caller.id,
      sourceId: 'threshold'
    });
    await notifyAward(caller.id, badgeId);
    return badge;
  } catch (error) {
    const mapped = mapFirestoreError(error);
    if (mapped.code === 'content/exists') return null;
    throw mapped;
  }
}

/**
 * Awards every threshold badge the caller's own score now crosses.
 *
 * Best-effort by design: a refusal (offline, not an admin, already held)
 * must never roll back the reputation credit that triggered it.
 */
export async function claimEarnedThresholds(): Promise<UserBadge[]> {
  const uid = getServiceActor();
  const caller = uid ? userService.getById(uid) : undefined;
  if (!caller) return [];
  const held = await listUserBadges(caller.id).catch(() => [] as UserBadge[]);
  const heldIds = new Set(held.map(badge => badge.badgeId));
  const earned = DEFAULT_BADGES.filter(
    badge =>
      badge.kind === 'threshold' &&
      typeof badge.threshold === 'number' &&
      caller.reputation >= badge.threshold &&
      !heldIds.has(badge.id)
  );
  const claimed: UserBadge[] = [];
  for (const badge of earned) {
    try {
      const row = await claimThresholdBadge(badge.id);
      if (row) claimed.push(row);
    } catch {
      /* a moderator-only award is refused for everyone who is not one */
    }
  }
  return claimed;
}
