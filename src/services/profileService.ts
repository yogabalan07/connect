import { ActivityItem, Badge, Follow, ProfileStats, ReputationEvent, UserBadge } from '../types';
import { getContentAdapter } from './contentAdapter';
import { mapFirestoreError } from './firestoreErrors';
import { getServiceActor } from './actor';
import { listBadgeDefinitions } from './badgeService';
import { userService } from './userService';

/**
 * Profiles - the derived, tamper-evident view of a member.
 *
 * Layering: UI -> THIS file -> content adapter + user directory -> Firestore.
 *
 * Everything here is computed, never read off `users/{uid}` as a declared
 * number. That is the whole point: `firestore.rules` refuses any client
 * write to `followersCount` / `followingCount` / `badges`, and the counters
 * a profile shows come from `reputationEvents`, `follows` and `userBadges`
 * - three collections whose own read rules decide who may see them.
 *
 * Consequences worth stating out loud:
 * - Counts are derived at read time and cached for a few seconds, so a
 *   follow shows up on the next profile render rather than never.
 * - Content counts never shrink. The ledger has no clawback row for a
 *   deleted question or answer, so a profile honestly reports the work that
 *   was once proven - consistent with the reputation score beside it.
 * - A profile read for another member asks only for non-vote ledger rows,
 *   because a `vote` row names the voter and the rules fail closed.
 */
const PROFILE_TTL_MS = 15_000;

const statsCache = new Map<string, { stats: ProfileStats; expiresAt: number }>();

/** Drops the memoised profile - one member, or every member after a write. */
export function invalidateProfile(userId?: string): void {
  if (userId) statsCache.delete(userId);
  else statsCache.clear();
}

async function viaAdapter<T>(task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (error) {
    throw mapFirestoreError(error);
  }
}

function toBadge(
  row: UserBadge,
  definition: { name: string; description: string; icon: string; tier: Badge['tier'] }
): Badge {
  return {
    id: row.badgeId,
    name: definition.name,
    description: definition.description,
    icon: definition.icon,
    tier: definition.tier,
    unlockedAt: new Date(row.awardedAtMs).toISOString()
  };
}

/** A held row whose catalogue entry is missing still has to render. */
function badgeOrDefault(row: UserBadge): Badge {
  return toBadge(row, {
    name: row.badgeId.replace(/_/g, ' '),
    description: 'Badge unlocked on Connect.',
    icon: 'award',
    tier: 'bronze'
  });
}

/**
 * Every number a profile shows, derived in one round of parallel reads.
 *
 * `reputation` is the only field taken from `users/{uid}` - and that field
 * is itself written exclusively by `reputationCreditEdit()` in the same
 * commit as the ledger row that earned it.
 */
export async function getProfileStats(userId: string): Promise<ProfileStats> {
  const cached = statsCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.stats;

  const profile =
    userService.getById(userId) ?? (await userService.getUserProfile(userId).catch(() => null));

  const [questionsCount, answersCount, acceptedCount, followersCount, followingCount, held] =
    await Promise.all([
      viaAdapter(() => getContentAdapter().countDoubtsBy(userId)),
      viaAdapter(() => getContentAdapter().countAnswersBy(userId)),
      viaAdapter(() => getContentAdapter().countAccepted(userId)),
      viaAdapter(() => getContentAdapter().countFollowers(userId)),
      viaAdapter(() => getContentAdapter().countFollowing(userId)),
      listUserBadgesSafe(userId)
    ]);

  const definitions = await listBadgeDefinitions().catch(() => []);
  const byId = new Map(definitions.map(definition => [definition.id, definition]));

  const stats: ProfileStats = {
    userId,
    reputation: profile?.reputation ?? 0,
    questionsCount,
    answersCount,
    acceptedCount,
    followersCount,
    followingCount,
    badges: held
      .map(row => {
        const definition = byId.get(row.badgeId);
        return definition ? toBadge(row, definition) : badgeOrDefault(row);
      })
      .sort((a, b) => Date.parse(b.unlockedAt) - Date.parse(a.unlockedAt)),
    computedAtMs: Date.now()
  };

  statsCache.set(userId, { stats, expiresAt: Date.now() + PROFILE_TTL_MS });
  return stats;
}

/** A profile must render even when the badge list cannot be read. */
async function listUserBadgesSafe(userId: string): Promise<UserBadge[]> {
  try {
    return await getContentAdapter().listUserBadges(userId);
  } catch {
    return [];
  }
}

/** Follow edges pointing at `userId`, newest first. */
export function listFollowers(userId: string, limit = 50): Promise<Follow[]> {
  return viaAdapter(() => getContentAdapter().listFollowers(userId, { limit }));
}

/** Follow edges written by `userId`, newest first. */
export function listFollowing(userId: string, limit = 50): Promise<Follow[]> {
  return viaAdapter(() => getContentAdapter().listFollowing(userId, { limit }));
}

const EVENT_TITLES: Record<ReputationEvent['type'], (event: ReputationEvent) => string> = {
  question: () => 'Asked a question',
  answer: () => 'Posted an answer',
  accepted: () => 'Had an answer accepted',
  vote: event => (event.delta >= 0 ? 'Received an upvote' : 'Received a downvote')
};

/**
 * A member's public activity feed, merged from the three collections whose
 * read rules already gate visibility: the ledger, the follow edges and the
 * badges actually held.
 *
 * Vote rows are requested only when the profile being read belongs to the
 * signed-in member - `firestore.rules` refuses them for anyone else, and
 * this is the fail-closed behaviour we want rather than a silent subset.
 */
export async function getProfileActivity(userId: string, limit = 30): Promise<ActivityItem[]> {
  const isOwnProfile = getServiceActor() === userId;

  const [events, follows, held] = await Promise.all([
    getContentAdapter()
      .listReputationEvents(userId, { limit, includeVotes: isOwnProfile })
      .catch(() => [] as ReputationEvent[]),
    getContentAdapter()
      .listFollowers(userId, { limit })
      .catch(() => [] as Follow[]),
    listUserBadgesSafe(userId)
  ]);

  const definitions = await listBadgeDefinitions().catch(() => []);
  const badgeById = new Map(definitions.map(definition => [definition.id, definition]));

  const items: ActivityItem[] = [
    ...events.map(event => ({
      id: event.id,
      kind: event.type === 'vote' ? ('reputation' as const) : event.type,
      title: EVENT_TITLES[event.type](event),
      detail: `${event.delta >= 0 ? '+' : ''}${event.delta} reputation`,
      link: event.doubtId ? `/app/doubts/${event.doubtId}` : undefined,
      createdAtMs: event.createdAtMs
    })),
    ...follows.map(follow => ({
      id: `follow_${follow.id}`,
      kind: 'follow' as const,
      title: 'Gained a follower',
      detail: 'Someone started following this profile.',
      link: `/app/users/${follow.userId}`,
      createdAtMs: follow.createdAtMs
    })),
    ...held.map(row => ({
      id: `badge_${row.id}`,
      kind: 'badge' as const,
      title: `Earned ${badgeById.get(row.badgeId)?.name ?? row.badgeId}`,
      detail: badgeById.get(row.badgeId)?.description ?? 'Badge unlocked.',
      link: '/app/reputation',
      createdAtMs: row.awardedAtMs
    }))
  ];

  return items
    .filter(item => item.createdAtMs > 0)
    .sort((a, b) => b.createdAtMs - a.createdAtMs)
    .slice(0, limit);
}
