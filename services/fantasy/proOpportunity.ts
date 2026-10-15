import type { FantasyTeam } from '../../types/fantasy';
import { hasSamplePlayers } from '../../constants/sampleTeam';
import { isNhlLinked } from './positions';
import { shortDate } from '../nhl/dates';

export interface ProOpportunity {
  kind: 'lineup' | 'pickups' | 'moves';
  date?: string;
  emptySlots?: number;
  alternatives?: number;
}

/** Promotions for personal advice begin after the roster is linked and no longer a demo. */
export function needsPersonalRoster(team: FantasyTeam | null): boolean {
  return !team || hasSamplePlayers(team) || !team.players.some(isNhlLinked);
}

/** Only use measured opportunities supplied by a loaded screen; no projected host results. */
export function opportunityCopy(team: FantasyTeam, opportunity?: ProOpportunity): { title: string; detail: string } {
  const when = opportunity?.date ? ` on ${shortDate(opportunity.date)}` : '';
  if (opportunity?.emptySlots && opportunity.emptySlots > 0) {
    return {
      title: `${opportunity.emptySlots} open ${opportunity.emptySlots === 1 ? 'slot' : 'slots'}${when}`,
      detail: opportunity.kind === 'pickups'
        ? `${opportunity.alternatives ? `${opportunity.alternatives} more ranked options. ` : ''}Compare pickups by the nights and positions they can fill for your roster. Check availability in your league.`
        : 'Your free call covers one decision. Pro compares the rest of your lineup and plans around these gaps.',
    };
  }
  if (opportunity?.alternatives && opportunity.alternatives > 0) {
    return {
      title: `${opportunity.alternatives} more ${opportunity.kind === 'pickups' ? 'pickup options' : 'coach decisions'}${when}`,
      detail: 'Go beyond your free recommendation with the complete set of options for your roster.',
    };
  }
  return { title: `Built for your ${team.players.length}-player roster`, detail: 'Your free decision is yours to use. Pro adds full lineup comparisons, more pickup alternatives and planning across the week.' };
}
