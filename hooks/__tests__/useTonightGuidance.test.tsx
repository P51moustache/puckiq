jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
const mockOpenPlayer = jest.fn();
jest.mock('../../components/sheets/PlayerSheet', () => ({ usePlayerSheet: () => ({ openPlayer: mockOpenPlayer }) }));
const mockEnable = jest.fn(() => Promise.resolve(true));
jest.mock('../../components/RemindersProvider', () => ({
  useReminders: () => ({ settings: { enabled: false, minutesBefore: 60, liveStart: false }, permission: 'undetermined', enable: mockEnable }),
}));
const mockComplete = jest.fn();
let mockGuideActive = true;
jest.mock('../useFirstNight', () => ({
  useFirstNight: () => ({ active: mockGuideActive, done: [], complete: mockComplete, dismiss: jest.fn() }),
}));
let mockPromptArgs: any = null;
jest.mock('../useReminderPrompt', () => ({
  useReminderPrompt: (args: any) => {
    mockPromptArgs = args;
    return { visible: false, accept: jest.fn(), dismiss: jest.fn() };
  },
}));
let mockItem: any = null;
jest.mock('../useNextUp', () => ({ useNextUp: () => mockItem }));
const mockTrack = jest.fn();
jest.mock('../../services/analytics/track', () => ({ track: (...args: unknown[]) => mockTrack(...args) }));

// @ts-expect-error no types for react-test-renderer
import { act, create } from 'react-test-renderer';
import React from 'react';
import { useTonightGuidance, type TonightGuidance, type TonightGuidanceArgs } from '../useTonightGuidance';

const showTomorrow = jest.fn();
const showPlayers = jest.fn();
const player = { playerId: 8478402, playerName: 'Connor McDavid', teamAbbrev: 'EDM', position: 'C', rosterPosition: 'BN' };

function run(overrides: Partial<TonightGuidanceArgs> = {}): TonightGuidance {
  let result: TonightGuidance | null = null;
  const Probe = () => {
    result = useTonightGuidance({
      team: { players: [player] } as any,
      view: { date: '2026-10-13', night: { data: { playerGames: {} } } } as any,
      night: 'tonight',
      playing: [player] as any,
      isPro: false,
      showTomorrow,
      showPlayers,
      ...overrides,
    });
    return null;
  };
  act(() => {
    create(<Probe />);
  });
  return result!;
}

describe('useTonightGuidance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGuideActive = true;
    mockItem = null;
  });

  it('shows the guide on Tonight only, and offers reminders once the lineup call has loaded', () => {
    expect(run().firstNight.visible).toBe(true);
    expect(mockPromptArgs).toEqual({ gameDay: true, callShown: false });
    run({ view: { date: '2026-10-13', night: { data: { playerGames: {} } }, day: { starters: [], bench: [], empty: [] } } as any });
    expect(mockPromptArgs).toEqual({ gameDay: true, callShown: true });
    expect(run({ night: 'tomorrow' }).firstNight.visible).toBe(false);
    expect(mockPromptArgs.gameDay).toBe(false);
    expect(run({ team: { players: [] } as any }).firstNight.visible).toBe(false);
  });

  it('offers reminders only before tonight’s first puck drop', () => {
    run({ view: { date: '2026-10-13', night: { data: { playerGames: {} } }, score: { phase: 'live' } } as any });
    expect(mockPromptArgs.gameDay).toBe(false);
    run({ view: { date: '2026-10-13', night: { data: { playerGames: {} } }, score: { phase: 'pre' } } as any });
    expect(mockPromptArgs.gameDay).toBe(true);
  });

  it('runs each first-night step and records it', async () => {
    const guidance = run();
    await act(async () => { await guidance.firstNight.onStep('players'); });
    expect(showPlayers).toHaveBeenCalled();
    await act(async () => { await guidance.firstNight.onStep('pickup'); });
    expect(mockPush).toHaveBeenCalledWith('/pickups');
    await act(async () => { await guidance.firstNight.onStep('reminder'); });
    expect(mockEnable).toHaveBeenCalledWith({ source: 'first_night', liveStart: true });
    expect(mockComplete.mock.calls.map((call) => call[0])).toEqual(['players', 'pickup', 'reminder']);
  });

  it('sends step one to the next night when tonight is quiet', async () => {
    const guidance = run({ playing: [] });
    expect(guidance.firstNight.quietNight).toBe(true);
    await act(async () => { await guidance.firstNight.onStep('players'); });
    expect(showTomorrow).toHaveBeenCalled();
    expect(showPlayers).not.toHaveBeenCalled();
  });

  it('logs the next step once per night and kind, and acts on a tap', () => {
    mockItem = { kind: 'fill_slot', title: 't', detail: 'd', action: { type: 'pickups', date: '2026-10-13', slot: 'D' } };
    const guidance = run();
    expect(mockTrack).toHaveBeenCalledWith('next_up_view', { kind: 'fill_slot' });
    act(() => guidance.nextUp.onPress());
    expect(mockTrack).toHaveBeenCalledWith('next_up_tap', { kind: 'fill_slot' });
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/pickups', params: { date: '2026-10-13', slot: 'D' } });
  });

  it('opens the player, tomorrow or the week for the other kinds', () => {
    const tap = () => {
      const guidance = run();
      act(() => guidance.nextUp.onPress());
    };
    mockItem = { kind: 'hot_player', title: 't', detail: 'd', action: { type: 'player', playerId: 8478402 } };
    tap();
    expect(mockOpenPlayer).toHaveBeenCalledWith(8478402, 'roster', 'next_up');

    mockItem = { kind: 'tomorrow', title: 't', detail: 'd', action: { type: 'tomorrow' } };
    tap();
    expect(showTomorrow).toHaveBeenCalled();

    mockItem = { kind: 'week', title: 't', detail: 'd', action: { type: 'week' } };
    tap();
    expect(mockPush).toHaveBeenCalledWith('/week');
  });
});
