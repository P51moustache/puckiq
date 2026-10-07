jest.mock('expo-notifications', () => ({ getExpoPushTokenAsync: jest.fn() }));

import { alertPlayerIds, alertSignature, DEFAULT_ALERTS, MAX_ALERT_PLAYERS, parseAlertSettings } from '../alerts';
import { createTeam } from '../teams';

describe('player alerts', () => {
  it('starts off, with both kinds selected for when it’s turned on', () => {
    expect(parseAlertSettings(null)).toEqual(DEFAULT_ALERTS);
    expect(DEFAULT_ALERTS).toEqual({ enabled: false, scratches: true, goals: true });
    expect(parseAlertSettings('{"enabled":true,"goals":false}')).toEqual({ enabled: true, scratches: true, goals: false });
    expect(parseAlertSettings('not json')).toEqual(DEFAULT_ALERTS);
  });

  it('follows every linked NHL player across teams, once, IR included', () => {
    const a = createTeam({
      players: [
        { playerId: 8478402, playerName: 'Connor McDavid', teamAbbrev: 'EDM', position: 'C', rosterPosition: 'BN' },
        { playerId: 8480012, playerName: 'Cale Makar', teamAbbrev: 'COL', position: 'D', rosterPosition: 'BN', injuredReserve: true },
        { playerId: 42, playerName: 'Typed In', teamAbbrev: '', position: 'C', rosterPosition: 'BN' },
      ],
    });
    const b = createTeam({
      players: [{ playerId: 8478402, playerName: 'Connor McDavid', teamAbbrev: 'EDM', position: 'C', rosterPosition: 'BN' }],
    });
    expect(alertPlayerIds([a, b])).toEqual([8478402, 8480012]);
  });

  it('caps the list at the server limit', () => {
    const many = createTeam({});
    many.players = Array.from({ length: 200 }, (_, index) => ({
      playerId: 8_400_000 + index, playerName: `P ${index}`, teamAbbrev: 'EDM', position: 'C', rosterPosition: 'BN' as const,
    }));
    expect(alertPlayerIds([many])).toHaveLength(MAX_ALERT_PLAYERS);
  });

  it('changes its signature only when what the server stores changes', () => {
    const one = alertSignature('ExponentPushToken[x]', [1, 2], DEFAULT_ALERTS);
    expect(alertSignature('ExponentPushToken[x]', [1, 2], { ...DEFAULT_ALERTS, enabled: true })).toBe(one);
    expect(alertSignature('ExponentPushToken[x]', [1, 2], { ...DEFAULT_ALERTS, goals: false })).not.toBe(one);
    expect(alertSignature('ExponentPushToken[x]', [1, 3], DEFAULT_ALERTS)).not.toBe(one);
  });
});
