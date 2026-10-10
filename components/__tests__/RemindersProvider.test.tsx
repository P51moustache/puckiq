import React from 'react';
// @ts-expect-error react-test-renderer has no local type declarations
import { act, create } from 'react-test-renderer';
import type { FantasyTeam } from '../../types/fantasy';
import { createTeam } from '../../services/teams';
import { RemindersProvider } from '../RemindersProvider';

const TODAY = '2026-10-14';
const mockSync = jest.fn((..._args: unknown[]) => Promise.resolve(0));
const mockLoadInputs = jest.fn();
let mockSaved = { enabled: true, minutesBefore: 60, liveStart: false, onlyWhenNeeded: true };
let mockPermission = 'granted';
let mockTeams: { ready: boolean; teams: FantasyTeam[]; team: FantasyTeam | null } = { ready: true, teams: [], team: null };

jest.mock('react-native', () => ({ AppState: { addEventListener: () => ({ remove: () => undefined }) } }));
jest.mock('../../services/lineupReminders', () => ({
  clearLegacyNotifications: () => undefined,
  DEFAULT_REMINDERS: { enabled: false, minutesBefore: 60, liveStart: false, onlyWhenNeeded: true },
  getPermissionState: () => Promise.resolve(mockPermission),
  getReminderSettings: () => Promise.resolve(mockSaved),
  requestReminderPermission: () => Promise.resolve(true),
  saveReminderSettings: () => Promise.resolve(),
  syncLineupReminders: (...args: unknown[]) => mockSync(...args),
}));
jest.mock('../../services/reminders/reminderInputs', () => ({ loadReminderInputs: (...args: unknown[]) => mockLoadInputs(...args) }));
jest.mock('../../services/nhl/dates', () => ({ todayNhl: () => '2026-10-14' }));
jest.mock('../TeamsProvider', () => ({ useTeams: () => mockTeams }));
jest.mock('../../services/analytics/track', () => ({ track: () => undefined }));

const settle = () => act(async () => {
  for (let tick = 0; tick < 5; tick += 1) await new Promise((resolve) => setImmediate(resolve));
});

async function render() {
  let tree: any;
  await act(async () => {
    tree = create(<RemindersProvider>{null}</RemindersProvider>);
  });
  await settle();
  return tree;
}

const beauties = createTeam({ name: 'Beauties' });
const benchMob = createTeam({ name: 'Bench Mob' });
const INPUTS = { schedules: [{ monday: '2026-10-12', days: [] }], lineups: new Map([[beauties.id, new Map()]]) };

beforeEach(() => {
  mockSync.mockClear();
  mockLoadInputs.mockReset().mockResolvedValue(INPUTS);
  mockSaved = { enabled: true, minutesBefore: 60, liveStart: false, onlyWhenNeeded: true };
  mockPermission = 'granted';
  mockTeams = { ready: true, teams: [beauties, benchMob], team: benchMob };
});

describe('RemindersProvider', () => {
  it('loads every team’s lineups (the team on screen first) and schedules with them', async () => {
    await render();
    expect(mockLoadInputs).toHaveBeenCalledWith([benchMob, beauties], TODAY);
    expect(mockSync).toHaveBeenLastCalledWith([beauties, benchMob], INPUTS.schedules, mockSaved, INPUTS.lineups);
  });

  it('only clears reminders while they are off or not allowed', async () => {
    mockSaved = { ...mockSaved, enabled: false };
    await render();
    mockPermission = 'denied';
    mockSaved = { ...mockSaved, enabled: true };
    await render();
    expect(mockLoadInputs).not.toHaveBeenCalled();
    expect(mockSync.mock.calls.map((call) => [call[0], call[1]])).toEqual([[[], []], [[], []]]);
  });

  it('re-plans when a team’s scoring changes, not on a re-render with the same teams', async () => {
    const tree = await render();
    expect(mockLoadInputs).toHaveBeenCalledTimes(1);
    mockTeams = { ...mockTeams, teams: [...mockTeams.teams] };
    await act(async () => tree.update(<RemindersProvider>{null}</RemindersProvider>));
    await settle();
    expect(mockLoadInputs).toHaveBeenCalledTimes(1);
    const rescored = { ...beauties, scoring: { ...beauties.scoring, hits: beauties.scoring.hits + 1 } };
    mockTeams = { ...mockTeams, teams: [rescored, benchMob] };
    await act(async () => tree.update(<RemindersProvider>{null}</RemindersProvider>));
    await settle();
    expect(mockLoadInputs).toHaveBeenCalledTimes(2);
    expect(mockSync).toHaveBeenLastCalledWith([rescored, benchMob], INPUTS.schedules, mockSaved, INPUTS.lineups);
  });
});
