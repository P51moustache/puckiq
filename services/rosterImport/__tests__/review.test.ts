import type { RosterPlayer } from '../../nhl/rosters';
import type { RosterMatch } from '../matchRoster';
import { pickOption, playersToAdd, startReview, toFantasyPlayer, toggleChecked } from '../review';

const player = (playerId: number, firstName: string, lastName: string, team = 'EDM', position = 'C'): RosterPlayer => ({ playerId, firstName, lastName, team, position });
const MCDAVID = player(8478402, 'Connor', 'McDavid');
const DRAISAITL = player(8477934, 'Leon', 'Draisaitl');
const JACK = player(8481559, 'Jack', 'Hughes', 'NJD');
const LUKE = player(8482701, 'Luke', 'Hughes', 'NJD', 'D');

const match: RosterMatch = {
  matched: [
    { player: MCDAVID, confidence: 'exact', source: 'Connor McDavid' },
    { player: DRAISAITL, confidence: 'likely', source: 'L. Draisaitl' },
  ],
  ambiguous: [{ source: 'Hughes NJ', options: [JACK, LUKE] }],
  unmatched: [],
  leftovers: [],
};

describe('roster import review', () => {
  it('starts with every new player ticked and players I already have set aside', () => {
    const review = startReview(match, new Set([MCDAVID.playerId]));
    expect([...review.alreadyOnTeam]).toEqual([MCDAVID.playerId]);
    expect([...review.checked]).toEqual([DRAISAITL.playerId]);
    expect(playersToAdd(review)).toEqual([DRAISAITL]);
  });

  it('lets players be unticked, but never re-adds one already on the team', () => {
    let review = startReview(match, new Set([MCDAVID.playerId]));
    review = toggleChecked(review, DRAISAITL.playerId);
    expect(playersToAdd(review)).toEqual([]);
    expect(toggleChecked(review, MCDAVID.playerId)).toBe(review);
  });

  it('adds the picked player for a same-name question, and a second tap clears it', () => {
    let review = startReview(match, new Set());
    review = pickOption(review, 0, LUKE.playerId);
    expect(playersToAdd(review).map((p) => p.playerId)).toEqual([MCDAVID.playerId, DRAISAITL.playerId, LUKE.playerId]);
    review = pickOption(review, 0, LUKE.playerId);
    expect(playersToAdd(review).map((p) => p.playerId)).toEqual([MCDAVID.playerId, DRAISAITL.playerId]);
  });

  it('turns an NHL roster player into a bench player on my team', () => {
    expect(toFantasyPlayer(LUKE)).toEqual({ playerId: LUKE.playerId, playerName: 'Luke Hughes', teamAbbrev: 'NJD', position: 'D', rosterPosition: 'BN' });
  });
});
