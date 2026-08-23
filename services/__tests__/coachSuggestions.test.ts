import {
  LINEUP_HOST_NOTE,
  NHL_TIMING_NOTE,
  buildCoachSuggestions,
  visibleCoachSuggestions,
} from '../coachSuggestions';
import type { TonightPlayerStatus } from '../../types/fantasy';

function row(overrides: Partial<TonightPlayerStatus>): TonightPlayerStatus {
  return {
    playerId: 1,
    playerName: 'Connor McDavid',
    teamAbbrev: 'EDM',
    position: 'C',
    opponentAbbrev: 'CGY',
    isHome: true,
    gameId: 1,
    startTimeUTC: null,
    gameState: 'FUT',
    injurySignal: 'ok',
    injuryNote: null,
    confidence: 'unknown',
    recommendation: 'START',
    reason: "In tonight's lineup",
    ...overrides,
  };
}

describe('buildCoachSuggestions', () => {
  it('drops an IR player, sits a scratch, and starts a healthy contrast', () => {
    const suggestions = buildCoachSuggestions([
      row({ playerId: 1, playerName: 'Injured Star', injurySignal: 'out', recommendation: 'SIT' }),
      row({ playerId: 2, playerName: 'Scratch Winger', injurySignal: 'scratch', recommendation: 'SIT' }),
      row({ playerId: 3, playerName: 'Connor McDavid', recommendation: 'START' }),
    ]);
    expect(suggestions.map((s) => s.action)).toEqual(['DROP', 'SIT', 'START']);
    expect(suggestions[0].detail).toMatch(/IR/);
    expect(suggestions[2].detail).toMatch(/Injured Star/);
  });

  it('suggests a stream when someone is off and someone plays', () => {
    const suggestions = buildCoachSuggestions([
      row({ playerId: 1, playerName: 'Off Night', opponentAbbrev: null, recommendation: 'SIT', reason: 'No game tonight' }),
      row({ playerId: 2, playerName: 'Streamer', recommendation: 'START' }),
    ]);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].action).toBe('START');
    expect(suggestions[0].detail).toMatch(/Off Night/);
  });
});

describe('visibleCoachSuggestions', () => {
  const all = buildCoachSuggestions([
    row({ playerId: 1, playerName: 'A', injurySignal: 'out', recommendation: 'SIT' }),
    row({ playerId: 2, playerName: 'B', recommendation: 'START' }),
  ]);

  it('gives free users one sample', () => {
    expect(visibleCoachSuggestions(all, false)).toHaveLength(1);
  });

  it('gives Pro the full list', () => {
    expect(visibleCoachSuggestions(all, true).length).toBe(all.length);
    expect(all.length).toBeGreaterThan(1);
  });
});

describe('host and timing copy', () => {
  it('never claims we write the Yahoo lineup or beat the NHL', () => {
    expect(LINEUP_HOST_NOTE).toMatch(/never writes your lineup/i);
    expect(LINEUP_HOST_NOTE).toMatch(/Yahoo or ESPN/);
    expect(NHL_TIMING_NOTE).toMatch(/don’t beat the NHL|do not beat the NHL/i);
  });
});
