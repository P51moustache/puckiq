import { newInstallId, posthogConfig, sendToPostHog, toPostHogEvent } from '../posthog';

const app = { appVersion: '3.0.0', os: 'ios' };
const at = Date.parse('2026-10-13T23:00:00Z');

describe('posthog config', () => {
  it('is off without a key and trims the host', () => {
    expect(posthogConfig({}, false)).toBeNull();
    expect(posthogConfig({ EXPO_PUBLIC_POSTHOG_KEY: '  ' }, false)).toBeNull();
    expect(posthogConfig({ EXPO_PUBLIC_POSTHOG_KEY: 'phc_x' }, false)).toEqual({ apiKey: 'phc_x', host: 'https://us.i.posthog.com' });
    expect(posthogConfig({ EXPO_PUBLIC_POSTHOG_KEY: 'phc_x', EXPO_PUBLIC_POSTHOG_HOST: 'https://eu.i.posthog.com/' }, false)?.host).toBe('https://eu.i.posthog.com');
  });

  it('stays off in debug builds unless opted in', () => {
    expect(posthogConfig({ EXPO_PUBLIC_POSTHOG_KEY: 'phc_x' }, true)).toBeNull();
    expect(posthogConfig({ EXPO_PUBLIC_POSTHOG_KEY: 'phc_x', EXPO_PUBLIC_POSTHOG_DEV: '1' }, true)?.apiKey).toBe('phc_x');
  });
});

describe('toPostHogEvent', () => {
  it('maps screen views to $screen with the plan stamped on', () => {
    const out = toPostHogEvent(
      { event: 'screen_view', screen_name: '/week', screen_class: '/week', timestamp: at, session_id: 's1', user_id: 'supabase-uuid', is_pro: true } as any,
      'install-1',
      app,
    );
    expect(out).toEqual({
      event: '$screen',
      distinct_id: 'install-1',
      timestamp: '2026-10-13T23:00:00.000Z',
      properties: expect.objectContaining({ $screen_name: '/week', is_pro: true, session_id: 's1', $app_version: '3.0.0', $process_person_profile: false, environment: 'production' }),
    });
  });

  it('flattens custom event properties and never sends identifying fields', () => {
    const out = toPostHogEvent(
      {
        event: 'onboarding_complete',
        timestamp: at,
        session_id: 's1',
        user_id: 'supabase-uuid',
        properties: { players: 16, sample_team: false, email: 'someone@example.com', playerName: 'Connor McDavid' },
      } as any,
      'install-1',
      app,
    );
    expect(out.event).toBe('onboarding_complete');
    expect(out.distinct_id).toBe('install-1');
    expect(out.properties).toMatchObject({ players: 16, sample_team: false });
    const json = JSON.stringify(out);
    expect(json).not.toContain('supabase-uuid');
    expect(json).not.toContain('someone@example.com');
    expect(json).not.toContain('McDavid');
  });
});

describe('sendToPostHog', () => {
  it('posts one batch to /batch/ and throws on failure so events stay queued', async () => {
    const ok = jest.fn(async () => ({ ok: true, status: 200 }));
    await sendToPostHog({ apiKey: 'phc_x', host: 'https://us.i.posthog.com' }, [
      { event: 'player_open', timestamp: at, session_id: 's', properties: { context: 'roster' } } as any,
    ], 'install-1', app, ok as unknown as typeof fetch);
    expect(ok).toHaveBeenCalledTimes(1);
    const [url, init] = ok.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://us.i.posthog.com/batch/');
    const body = JSON.parse(String(init.body));
    expect(body.api_key).toBe('phc_x');
    expect(body.batch[0]).toMatchObject({ event: 'player_open', distinct_id: 'install-1', properties: { context: 'roster' } });

    const fail = jest.fn(async () => ({ ok: false, status: 503 }));
    await expect(sendToPostHog({ apiKey: 'phc_x', host: 'h' }, [{ event: 'x', timestamp: at, session_id: 's' } as any], 'i', app, fail as unknown as typeof fetch))
      .rejects.toThrow('503');
    expect(await sendToPostHog({ apiKey: 'phc_x', host: 'h' }, [], 'i', app, fail as unknown as typeof fetch)).toBeUndefined();
  });

  it('makes a random UUID-shaped install id', () => {
    const id = newInstallId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(newInstallId()).not.toBe(id);
  });
});
