/**
 * Trade ideas across the whole room (Pro): `findTrades` against every other member, then the
 * best few with different league-mates first, so the card isn't three versions of one deal. Pure.
 */

import type { FantasyPlayer } from '../../types/fantasy';
import type { RoomSnapshot } from '../../types/league';
import type { WeekSchedule } from '../../services/nhl/schedule';
import { compareTradeIdeas, findTrades, otherMembers, type TradeIdea } from '../../services/league';

/** Ideas on the card. */
export const ROOM_TRADE_IDEAS = 3;

export interface RoomTradeIdea extends TradeIdea {
  partnerId: string;
  partnerName: string;
}

export interface RoomTradeInput {
  snapshot: RoomSnapshot;
  /** My roster as this device has it (the room's copy can lag by a few seconds). */
  mine: FantasyPlayer[];
  values: Map<number, number>;
  startShares?: Map<number, number>;
  schedules: WeekSchedule[];
  today: string;
  limit?: number;
}

/** The services' fair-deal order, then the partner's name so ties across partners are stable. */
function byBothSides(a: RoomTradeIdea, b: RoomTradeIdea): number {
  return compareTradeIdeas(a, b) || a.partnerName.localeCompare(b.partnerName);
}

/** The best ideas, one per league-mate first; a partner repeats only when there aren't enough. */
export function roomTradeIdeas({ snapshot, mine, values, startShares, schedules, today, limit = ROOM_TRADE_IDEAS }: RoomTradeInput): RoomTradeIdea[] {
  const ranked = otherMembers(snapshot)
    .flatMap((member) =>
      findTrades({ mine, theirs: member.roster, slots: snapshot.room.slots, values, startShares, schedules, today, limit }).map(
        (idea): RoomTradeIdea => ({ ...idea, partnerId: member.userId, partnerName: member.teamName }),
      ),
    )
    .sort(byBothSides);
  const partners = new Set<string>();
  const firstPerPartner = ranked.filter((idea) => {
    if (partners.has(idea.partnerId)) return false;
    partners.add(idea.partnerId);
    return true;
  });
  const rest = ranked.filter((idea) => !firstPerPartner.includes(idea));
  return [...firstPerPartner, ...rest].slice(0, Math.max(0, limit));
}
