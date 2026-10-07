/**
 * League UI fixtures: the services' room fixtures (one source of truth) plus a three-team room
 * on a Wednesday with games tonight, shared by the screen and hook tests.
 */

import type { RoomReactionRow, RoomSnapshot } from '../../../../types/league';
import { busyNight, game, makeRoom, member, ME, NOW, player, slotsOf, snapshotOf, week } from '../../../../services/league/__tests__/fixtures';

export {
  busyNight,
  game,
  line,
  makeRoom,
  makeTeam,
  member,
  ME,
  NOW,
  player,
  ROOM_ID,
  slotsOf,
  snapshotOf,
  week,
} from '../../../../services/league/__tests__/fixtures';

export const MON = '2026-10-12';
/** The fixtures' NOW (Wednesday noon UTC) as an NHL game day. */
export const TODAY = '2026-10-14';
export const FRI = '2026-10-16';

export const BEN = 'u-ben';
export const SAM = 'u-sam';

export const mcdavid = player(8478402, 'Connor McDavid', 'EDM', 'C');
export const makar = player(8480012, 'Cale Makar', 'COL', 'D');
export const shesterkin = player(8478048, 'Igor Shesterkin', 'NYR', 'G');
export const hughes = player(8481559, 'Jack Hughes', 'NJD', 'C');
export const quinn = player(8480845, 'Quinn Hughes', 'VAN', 'D');
export const oettinger = player(8479979, 'Jake Oettinger', 'DAL', 'G');

export const edmCol = game(TODAY, 'EDM', 'COL', { startTimeUTC: `${TODAY}T23:00:00Z` });
export const njdVan = game(TODAY, 'NJD', 'VAN', { startTimeUTC: `${TODAY}T23:30:00Z` });

/** This week: EDM–COL and NJD–VAN tonight, plus a Friday game each for EDM and NJD. */
export const thisWeek = week(MON, {
  [MON]: busyNight(MON),
  [TODAY]: [edmCol, njdVan, ...busyNight(TODAY)],
  [FRI]: [game(FRI, 'EDM', 'NJD'), ...busyNight(FRI)],
});

const HOUR_MS = 60 * 60 * 1000;

export function reaction(id: number, toUserId: string, emoji: RoomReactionRow['emoji'], hoursAgo = 1, fromUserId = BEN): RoomReactionRow {
  return { id, roomId: 'room-1', fromUserId, toUserId, emoji, createdAt: new Date(NOW.getTime() - hoursAgo * HOUR_MS).toISOString() };
}

/** Me (owner) with McDavid, Makar and Shesterkin; Ben with Hughes, Quinn and Oettinger; Sam joined without a roster. */
export function roomSnapshot(patch: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return snapshotOf(
    [
      member(ME, 'Zach Attack', [mcdavid, makar, shesterkin]),
      member(BEN, 'Ben’s Bombers', [hughes, quinn, oettinger]),
      member(SAM, 'Sam’s Snipers', []),
    ],
    { room: makeRoom({ name: 'Beer League', leagueSize: 10, slots: slotsOf({ C: 1, D: 1, G: 1 }) }), ...patch },
  );
}
