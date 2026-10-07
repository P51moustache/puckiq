import {
  MAX_PLAYER_IDS,
  isExpoPushToken,
  parseRegistration,
  parseUnregistration,
  registrationToRow,
} from '../alertRegistration';

const valid = {
  token: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
  playerIds: [8478402, 8477934, 8478402],
  prefs: { scratches: true, goals: false },
  appVersion: '3.1.0',
};

describe('isExpoPushToken', () => {
  it.each([
    ['ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]', true],
    ['ExpoPushToken[abc-DEF_123]', true],
    ['ExponentPushToken[]', false],
    ['ExponentPushToken[has space]', false],
    ['ExponentPushToken[a[b]]', false],
    ['FcmToken[abc]', false],
    [`ExponentPushToken[${'x'.repeat(200)}]`, false],
    [42, false],
  ])('%s -> %s', (token, expected) => {
    expect(isExpoPushToken(token)).toBe(expected);
  });
});

describe('parseRegistration', () => {
  it('accepts the documented body, dedupes ids and defaults the platform', () => {
    expect(parseRegistration(valid)).toEqual({
      ok: true,
      value: {
        token: valid.token,
        playerIds: [8478402, 8477934],
        prefs: { scratches: true, goals: false },
        appVersion: '3.1.0',
        platform: 'ios',
      },
    });
  });

  it('allows no players, no app version and an explicit platform', () => {
    const result = parseRegistration({ token: valid.token, playerIds: [], prefs: valid.prefs, platform: 'android' });
    expect(result).toMatchObject({ ok: true, value: { playerIds: [], appVersion: null, platform: 'android' } });
  });

  it.each([
    ['not an object', null, 'invalid_body'],
    ['array body', [valid], 'invalid_body'],
    ['bad token', { ...valid, token: 'nope' }, 'invalid_token'],
    ['ids not an array', { ...valid, playerIds: '8478402' }, 'invalid_player_ids'],
    ['string id', { ...valid, playerIds: ['8478402'] }, 'invalid_player_ids'],
    ['negative id', { ...valid, playerIds: [-1] }, 'invalid_player_ids'],
    ['fractional id', { ...valid, playerIds: [1.5] }, 'invalid_player_ids'],
    ['too many ids', { ...valid, playerIds: Array.from({ length: MAX_PLAYER_IDS + 1 }, (_, i) => i + 1) }, 'invalid_player_ids'],
    ['missing prefs', { ...valid, prefs: undefined }, 'invalid_prefs'],
    ['non-boolean pref', { ...valid, prefs: { scratches: 'yes', goals: true } }, 'invalid_prefs'],
    ['long app version', { ...valid, appVersion: 'x'.repeat(33) }, 'invalid_app_version'],
    ['numeric app version', { ...valid, appVersion: 3 }, 'invalid_app_version'],
    ['unknown platform', { ...valid, platform: 'web' }, 'invalid_platform'],
  ])('rejects %s', (_label, body, error) => {
    expect(parseRegistration(body)).toEqual({ ok: false, error });
  });

  it('accepts exactly the maximum number of ids', () => {
    const playerIds = Array.from({ length: MAX_PLAYER_IDS }, (_, i) => 8_470_000 + i);
    expect(parseRegistration({ ...valid, playerIds })).toMatchObject({ ok: true });
  });
});

describe('parseUnregistration', () => {
  it('needs only a valid token', () => {
    expect(parseUnregistration({ token: valid.token })).toEqual({ ok: true, value: { token: valid.token } });
    expect(parseUnregistration({ token: 'x' })).toEqual({ ok: false, error: 'invalid_token' });
    expect(parseUnregistration('x')).toEqual({ ok: false, error: 'invalid_body' });
  });
});

describe('registrationToRow', () => {
  it('builds the snake_case alert_devices row', () => {
    const parsed = parseRegistration(valid);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(registrationToRow(parsed.value, '2026-10-06T12:00:00.000Z')).toEqual({
      expo_push_token: valid.token,
      player_ids: [8478402, 8477934],
      prefs: { scratches: true, goals: false },
      platform: 'ios',
      app_version: '3.1.0',
      updated_at: '2026-10-06T12:00:00.000Z',
    });
  });
});
