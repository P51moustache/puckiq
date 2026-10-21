/**
 * Push copy for goal and scratch alerts, laid out as a checklist (docs/design/notifications, concept B):
 * a short title naming the player, then one fact per line.
 *
 *   🚨 Gauthier scores
 *   ANA leads FLA 2–1 · 2nd, 0:47
 *   Goal #2 this season
 *   Assist: Carlsson
 *
 * Pure and import-free so Deno and jest both load it as is. The events come from alerts.ts.
 */

const SIREN = '\u{1F6A8}';
const EN_DASH = '–';
/** Between facts on one line. */
const SEPARATOR = ' · ';
/** Between lines: one fact per line. */
const LINE_BREAK = '\n';

export type TeamSide = 'away' | 'home';

export interface GoalAlertEvent {
  kind: 'goal';
  key: string;
  gameId: number;
  scorer: { playerId: number; shortName: string };
  scorerSeasonGoals: number | null;
  assists: { playerId: number; shortName: string }[];
  /** Team abbreviations and the score right after the goal. */
  away: { abbrev: string; score: number };
  home: { abbrev: string; score: number };
  /** The team that scored; null when the feed doesn't say. */
  scoringSide: TeamSide | null;
  /** periodLabel(): P1-P3, OT, 2OT, ... */
  period: string;
  /** "0:47" */
  clock: string;
}

export interface ScratchAlertEvent {
  kind: 'scratch';
  key: string;
  gameId: number;
  playerId: number;
  /** Last name, or the full name when there's no last name. */
  shortName: string;
  /** "SJS vs LAK" from the scratched player's side; empty when the feed lacks an abbreviation. */
  matchup: string;
  gameStarted: boolean;
}

export type AlertEvent = GoalAlertEvent | ScratchAlertEvent;

export interface AlertCopy {
  title: string;
  body: string;
  /** The followed player the alert is about (opens with this player in mind). */
  playerId: number;
}

/** Goal copy for one device, or null when none of its players figure in the goal. */
export function formatGoalAlert(event: GoalAlertEvent, followed: ReadonlySet<number>): AlertCopy | null {
  if (followed.has(event.scorer.playerId)) return myScorerCopy(event);
  const myAssists = event.assists.filter((assist) => followed.has(assist.playerId));
  if (myAssists.length === 0) return null;
  const names = myAssists.map((assist) => assist.shortName);
  const title = names.length === 1 ? `${SIREN} ${names[0]} gets an assist` : `${SIREN} ${names.join(' and ')} get assists`;
  return {
    title,
    body: [`${event.scorer.shortName} scored${SEPARATOR}${scoreState(event)}`, periodText(event, true)].join(LINE_BREAK),
    playerId: myAssists[0].playerId,
  };
}

export function formatScratchAlert(event: ScratchAlertEvent): AlertCopy {
  const report = `Out per the NHL game report${event.matchup ? ` (${event.matchup})` : ''}`;
  return {
    title: `${event.shortName} scratched tonight`,
    body: event.gameStarted ? report : [report, 'Swap him before lock'].join(LINE_BREAK),
    playerId: event.playerId,
  };
}

/** The tally and the assists get a line each: together, two assists would wrap on a phone. */
function myScorerCopy(event: GoalAlertEvent): AlertCopy {
  const lines = [`${scoreState(event)}${SEPARATOR}${periodText(event, false)}`];
  if (event.scorerSeasonGoals !== null) lines.push(`Goal #${event.scorerSeasonGoals} this season`);
  if (event.assists.length > 0) {
    lines.push(`${event.assists.length === 1 ? 'Assist' : 'Assists'}: ${event.assists.map((a) => a.shortName).join(', ')}`);
  }
  return { title: `${SIREN} ${event.scorer.shortName} scores`, body: lines.join(LINE_BREAK), playerId: event.scorer.playerId };
}

/**
 * The game after the goal, leader first: "ANA leads FLA 2–1", "ANA ties FLA 2–2", and for an
 * overtime goal (always the winner) "ANA beats FLA 3–2".
 */
export function scoreState(event: GoalAlertEvent): string {
  const { away, home, scoringSide } = event;
  if (!away.abbrev || !home.abbrev) return `${away.score}${EN_DASH}${home.score}`;
  const score = (first: { score: number }, second: { score: number }) => `${first.score}${EN_DASH}${second.score}`;
  if (away.score === home.score) {
    if (!scoringSide) return `${away.abbrev} and ${home.abbrev} tied ${score(away, home)}`;
    const [scorer, other] = scoringSide === 'away' ? [away, home] : [home, away];
    return `${scorer.abbrev} ties ${other.abbrev} ${score(scorer, other)}`;
  }
  const [leader, trailer] = away.score > home.score ? [away, home] : [home, away];
  const verb = isOvertime(event.period) ? 'beats' : 'leads';
  return `${leader.abbrev} ${verb} ${trailer.abbrev} ${score(leader, trailer)}`;
}

/** "2nd, 0:47", or with `long` "2nd period, 0:47"; overtime stays "OT, 4:14". */
export function periodText(event: Pick<GoalAlertEvent, 'period' | 'clock'>, long: boolean): string {
  const regulation = /^P(\d+)$/.exec(event.period);
  const name = regulation ? `${ordinal(Number(regulation[1]))}${long ? ' period' : ''}` : event.period;
  return event.clock ? `${name}, ${event.clock}` : name;
}

function isOvertime(period: string): boolean {
  return /OT$/.test(period);
}

function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suffix}`;
}
