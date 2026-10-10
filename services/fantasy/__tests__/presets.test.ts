jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

import { presetFor, slotsLabel, slotsPresetFor, STANDARD_SLOTS, YAHOO_SLOTS } from '../lineup';
import { DEFAULT_SCORING, sameScoring, scoringPresetFor, skaterPoints, YAHOO_POINTS_SCORING } from '../scoring';
import { createTeam } from '../../teams';

describe('platform presets', () => {
  it('starts Yahoo teams on Yahoo’s default lineup (no Util) and others on the standard one', () => {
    expect(slotsLabel(YAHOO_SLOTS)).toBe('2 C · 2 LW · 2 RW · 4 D · 2 G');
    expect(slotsPresetFor('yahoo')).toEqual(YAHOO_SLOTS);
    expect(slotsPresetFor('espn')).toEqual(STANDARD_SLOTS);
    expect(presetFor(YAHOO_SLOTS)?.id).toBe('yahoo');
  });

  it('scores a Yahoo night the way the Yahoo app does', () => {
    // 1 G, 2 A, 1 PPP, 5 SOG, 2 BLK, +2: 6 + 8 + 2 + 4.5 + 2 + 4 = 26.5 (hits don't count on Yahoo).
    expect(skaterPoints({ goals: 1, assists: 2, ppp: 1, shots: 5, hits: 4, blocks: 2, plusMinus: 2 }, scoringPresetFor('yahoo'))).toBeCloseTo(26.5);
    expect(sameScoring(scoringPresetFor('fantrax'), DEFAULT_SCORING)).toBe(true);
  });

  it('hands out copies, so editing a team never edits the preset', () => {
    const preset = scoringPresetFor('yahoo');
    preset.goals = 99;
    expect(YAHOO_POINTS_SCORING.goals).toBe(6);
  });

  it('creates a team with the scoring it is given', () => {
    expect(createTeam({ platform: 'yahoo', scoring: scoringPresetFor('yahoo') }).scoring).toEqual(YAHOO_POINTS_SCORING);
    expect(createTeam({}).scoring).toEqual(DEFAULT_SCORING);
  });
});
