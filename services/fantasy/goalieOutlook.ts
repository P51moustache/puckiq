/**
 * A goalie's start outlook for one night — likely, split or unlikely, with one short reason —
 * and the per-night start chance the week planner uses. The NHL names starters only at puck
 * drop, so this is an estimate from three inputs: his season start share, whether his team is
 * on a back-to-back, and on a second night who started the first one (box score `starter`).
 * Never "confirmed". Pure: services/nhl/goalieStarts loads the inputs.
 */

import type { FantasyPlayer } from '../../types/fantasy';
import type { BackToBackRole, FirstNightStarter, GoalieNight, GoalieNights, GoalieRef } from '../nhl/goalieStarts';
import type { PlayerForm } from './form';
import { isGoalie, isNhlLinked } from './positions';
import type { PlanInput } from './weekPlan';

export type StartOutlook = 'likely' | 'split' | 'unlikely';

/** The night being read, as the user sees it: on tomorrow’s, the first night is "today", not "last night". */
export type OutlookNight = 'tonight' | 'tomorrow';

export interface GoalieOutlookInput {
  /** His share of his team's games started (0–1), from PlayerForm.startShare. */
  startShare: number;
  backToBack: BackToBackRole | null;
  /** Second nights: who started the first one. Absent means unknown. */
  firstNightStarter?: FirstNightStarter;
  /** Default 'tonight'. */
  night?: OutlookNight;
}

export interface GoalieOutlook {
  outlook: StartOutlook;
  /** Estimated chance he starts (0–1). */
  chance: number;
  /** One short reason in words (no numbers: free users see it). */
  reason: string;
  backToBack: BackToBackRole | null;
}

/** Even odds: a tandem splitting a back-to-back gives each goalie one of the two nights. */
const EVEN = 0.5;

/**
 * About 14 back-to-back sets a season, so 28 of 82 games (~34%) are one half of one. Tandems
 * usually split those, so a starter's chance on any other night sits a bit above his season
 * share: the share averages both kinds of night.
 */
const BACK_TO_BACK_SETS = 14;
const SEASON_GAMES = 82;
const BACK_TO_BACK_GAME_SHARE = (2 * BACK_TO_BACK_SETS) / SEASON_GAMES;

/**
 * How much of his edge over even odds a goalie keeps on a back-to-back night when nobody knows
 * who starts the other half. Most tandems split them; some starters play both.
 */
const BACK_TO_BACK_EDGE_KEPT = 0.25;

/**
 * Chance of starting the second night after starting the first, per unit of start share: a 70%
 * starter plays both halves about one time in six (0.7 × 0.25 ≈ 0.18); a backup almost never.
 */
const REPEAT_PER_SHARE = 0.25;

/**
 * Start share at which a goalie is half of a tandem. Below it (a third goalie, a fill-in) the
 * back-to-back pull toward even odds shrinks in proportion, so a 5% goalie doesn't jump to 50/50.
 */
const TANDEM_MIN_SHARE = 0.25;

/**
 * Outlook cut-offs on the chance: a 60% starter on an ordinary night (~64%) is "likely"; below
 * about one start in three is "unlikely". A back-to-back with no first-night news is a toss-up
 * at best, however big his share: tandems usually split them.
 */
const LIKELY_MIN = 0.6;
const UNLIKELY_BELOW = 0.35;

/** What the night is, from his side: one per reason. */
type Situation = 'regular' | 'first' | 'second' | 'afterHim' | 'afterPartner';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const lerp = (from: number, to: number, weight: number) => from + (to - from) * weight;
/** 1 for half of a tandem or more, shrinking toward 0 for a goalie who rarely starts. */
const tandemWeight = (share: number) => Math.min(1, share / TANDEM_MIN_SHARE);

/** A back-to-back night when nobody knows who starts the other half: pulled toward even odds. */
function backToBackChance(share: number): number {
  return lerp(share, EVEN + (share - EVEN) * BACK_TO_BACK_EDGE_KEPT, tandemWeight(share));
}

const CHANCE: Record<Situation, (share: number) => number> = {
  // His share with the back-to-back nights' near-even odds taken out.
  regular: (share) => clamp01((share - BACK_TO_BACK_GAME_SHARE * backToBackChance(share)) / (1 - BACK_TO_BACK_GAME_SHARE)),
  first: backToBackChance,
  second: backToBackChance,
  afterHim: (share) => share * REPEAT_PER_SHARE,
  // His partner had the first night: the second is usually his.
  afterPartner: (share) => lerp(share, 1 - (1 - share) * REPEAT_PER_SHARE, tandemWeight(share)),
};

function situationOf({ backToBack, firstNightStarter }: GoalieOutlookInput): Situation {
  if (backToBack !== 'second') return backToBack ?? 'regular';
  if (firstNightStarter === 'him') return 'afterHim';
  return firstNightStarter === 'partner' ? 'afterPartner' : 'second';
}

function shareOf(input: GoalieOutlookInput): number {
  return Number.isFinite(input.startShare) ? clamp01(input.startShare) : EVEN;
}

/** Estimated chance he starts the night (0–1) — what the week planner sums. */
export function startChance(input: GoalieOutlookInput): number {
  return CHANCE[situationOf(input)](shareOf(input));
}

function outlookOf(chance: number, situation: Situation): StartOutlook {
  if (chance < UNLIKELY_BELOW) return 'unlikely';
  const tossUpAtBest = situation === 'first' || situation === 'second';
  return chance >= LIKELY_MIN && !tossUpAtBest ? 'likely' : 'split';
}

// "today", not "tonight": the first night may be an afternoon game.
const NIGHT_BEFORE: Record<OutlookNight, string> = { tonight: 'last night', tomorrow: 'today' };
const NIGHT_AFTER: Record<OutlookNight, string> = { tonight: 'tomorrow', tomorrow: 'the next night' };
const REGULAR_REASON: Record<StartOutlook, string> = {
  likely: 'Usual starter',
  split: 'Shares the net with his partner',
  unlikely: 'Usual backup',
};

function reasonFor(situation: Situation, share: number, outlook: StartOutlook, night: OutlookNight): string {
  const starter = share >= EVEN;
  const usually = starter ? 'starters usually play one' : 'backups usually get one';
  switch (situation) {
    case 'regular':
      return REGULAR_REASON[outlook];
    case 'first':
      return `Back-to-back ${NIGHT_AFTER[night]} too — ${usually}`;
    case 'second':
      return `Back-to-back after ${NIGHT_BEFORE[night]} — ${usually}`;
    case 'afterHim':
      return `Started ${NIGHT_BEFORE[night]} — ${starter ? 'backups usually get' : 'the starter usually gets'} the second half of a back-to-back`;
    case 'afterPartner':
      return `Back-to-back — his partner started ${NIGHT_BEFORE[night]}`;
  }
}

export function goalieOutlook(input: GoalieOutlookInput): GoalieOutlook {
  const share = shareOf(input);
  const situation = situationOf(input);
  const chance = CHANCE[situation](share);
  const outlook = outlookOf(chance, situation);
  return { outlook, chance, reason: reasonFor(situation, share, outlook, input.night ?? 'tonight'), backToBack: input.backToBack };
}

const OUTLOOK_WORD: Record<StartOutlook, string> = {
  likely: 'START LIKELY',
  split: 'TOSS-UP',
  unlikely: 'BACKUP LIKELY',
};

/** The tag's words: "B2B · BACKUP LIKELY", "START LIKELY", "TOSS-UP"… */
export function outlookLabel({ outlook, backToBack }: Pick<GoalieOutlook, 'outlook' | 'backToBack'>): string {
  return `${backToBack ? 'B2B · ' : ''}${OUTLOOK_WORD[outlook]}`;
}

/** NHL-linked goalies off IR, once each, with the team whose schedule decides their nights. */
export function goalieRefs(players: FantasyPlayer[]): GoalieRef[] {
  const refs = new Map<number, GoalieRef>();
  for (const player of players) {
    if (!isNhlLinked(player) || player.injuredReserve || !isGoalie(player) || !player.teamAbbrev) continue;
    if (!refs.has(player.playerId)) refs.set(player.playerId, { playerId: player.playerId, team: player.teamAbbrev.toUpperCase() });
  }
  return [...refs.values()];
}

/**
 * Outlooks for the goalies playing one night. Without NHL numbers (form basis 'none') his share
 * is a placeholder, so only a back-to-back gives him one.
 */
export function nightOutlooks(
  nights: ReadonlyMap<number, GoalieNight>,
  forms: ReadonlyMap<number, PlayerForm>,
  night: OutlookNight = 'tonight',
): Map<number, GoalieOutlook> {
  const outlooks = new Map<number, GoalieOutlook>();
  for (const [playerId, context] of nights) {
    const form = forms.get(playerId);
    if (!form?.isGoalie || (form.basis === 'none' && context.backToBack === null)) continue;
    outlooks.set(playerId, goalieOutlook({ startShare: form.startShare, ...context, night }));
  }
  return outlooks;
}

/** The planner's start chance for each goalie with an outlook on `date` (other nights keep their share). */
export function outlookChances(outlooks: ReadonlyMap<number, GoalieOutlook>, date: string): PlanInput['startChanceOn'] {
  if (outlooks.size === 0) return undefined;
  return (playerId, day) => (day === date ? outlooks.get(playerId)?.chance : undefined);
}

/**
 * The week planner's per-night goalie inputs. With no nights yet (loading, failed) there are
 * none, so the plan keeps every goalie's flat start share.
 */
export function plannerGoalieInputs(
  nights: GoalieNights | null,
  shares: ReadonlyMap<number, number>,
): Pick<PlanInput, 'startChanceOn' | 'backToBackOn'> {
  if (!nights) return {};
  return {
    startChanceOn: (playerId, date) => {
      const night = nights.get(playerId)?.get(date);
      const share = shares.get(playerId);
      return night && share !== undefined ? startChance({ startShare: share, ...night }) : undefined;
    },
    backToBackOn: (playerId, date) => nights.get(playerId)?.get(date)?.backToBack ?? undefined,
  };
}
