import { ReputationEvent } from '../types';
import { getContentAdapter } from './contentAdapter';
import type { ReputationEventDraft, ReputationQuery } from './contentAdapter';
import { mapFirestoreError } from './firestoreErrors';
import { notificationService } from './notificationService';
import { userService } from './userService';

/**
 * Reputation ledger - the one place a reputation number is ever produced.
 *
 * Layering: UI -> context -> THIS file -> content adapter -> Firestore.
 *
 * Rules of the road:
 * - The adapter derives the deterministic document id and the point value
 *   from the work itself, and `firestore.rules` recomputes both, so no
 *   caller - including this file - can choose a score.
 * - `users.reputation` only ever moves through the `reputationCreditEdit()`
 *   branch of the rules, in the same commit as the event. `record` does the
 *   matching in-memory refresh so the signed-in member's directory copy
 *   matches the number Firestore now holds; it is a cache, never a source.
 * - A milestone is booked once. Re-running the same claim (retry, or
 *   re-accepting an answer that was accepted before) returns `null` rather
 *   than an error or a second credit.
 * - `vote` rows are minted by `saveVote`, never here: they have to be in the
 *   same atomic commit as the voter's own `votes/{…}` document.
 */
const MILESTONE_REASONS: Record<'question' | 'answer' | 'accepted', string> = {
  question: 'You earned points for asking a question on Connect.',
  answer: 'You earned points for posting an answer on Connect.',
  accepted: 'Your answer was accepted, earning the author reputation points.'
};

/** The identity that has to appear as the caller of each mint. */
function actingFor(draft: ReputationEventDraft): string {
  return draft.type === 'accepted' ? draft.actorId : draft.userId;
}

/**
 * Books a reputation milestone and mirrors the resulting score onto the
 * local directory copy.
 *
 * Returns the persisted event, or `null` when the milestone had already
 * been booked - which is the expected outcome of a retry and of
 * re-accepting an answer, so callers treat it as a quiet no-op.
 */
export async function record(draft: ReputationEventDraft): Promise<ReputationEvent | null> {
  try {
    const event = await getContentAdapter().createReputationEvent(actingFor(draft), draft);
    userService.adjustStats(event.userId, { reputation: event.delta });
    // Only an earner's own milestone can be announced: `firestore.rules`
    // pins a `reputation` notification to a ledger row whose beneficiary is
    // the sender, so an acceptor or a voter cannot push one into someone
    // else's inbox. Delivery is best-effort - the credit already stands.
    if (event.type === 'question' || event.type === 'answer') {
      const beneficiary = userService.getById(event.userId);
      if (beneficiary) {
        try {
          await notificationService.notifyReputation(
            event.userId,
            { id: beneficiary.id, name: beneficiary.name, avatar: beneficiary.avatar },
            event.delta,
            MILESTONE_REASONS[event.type],
            event.id
          );
        } catch {
          /* the credit is booked either way */
        }
      }
    }
    return event;
  } catch (error) {
    const mapped = mapFirestoreError(error);
    if (mapped.code === 'content/exists') return null;
    throw mapped;
  }
}

/**
 * Reads a member's ledger.
 *
 * `includeVotes` is only honest for the member's own history: a vote row
 * names the voter, and `firestore.rules` refuses the query for anyone else
 * rather than quietly returning the public subset.
 */
export async function history(
  userId: string,
  query?: ReputationQuery
): Promise<ReputationEvent[]> {
  try {
    return await getContentAdapter().listReputationEvents(userId, query);
  } catch (error) {
    throw mapFirestoreError(error);
  }
}
