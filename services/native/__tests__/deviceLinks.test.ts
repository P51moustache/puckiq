/**
 * deviceLinks: the React Native side of safeOpen. Linking is mocked as a class instance whose
 * openURL reads `this`, like react-native's, so a bare `Linking.openURL` reference would fail here
 * the way it failed on 3.3.0 phones.
 */

class MockLinking {
  readonly calls: string[] = [];
  respond: () => Promise<unknown> = () => Promise.resolve(true);
  openURL(url: string) {
    this.calls.push(url);
    return this.respond();
  }
}

const mockLinking = new MockLinking();
const mockAlert = jest.fn();
const mockBrowser = jest.fn();
const mockTrack = jest.fn();
jest.mock('react-native', () => ({ Linking: mockLinking, Alert: { alert: (...args: unknown[]) => mockAlert(...args) } }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: (url: string) => mockBrowser(url) }));
jest.mock('../../analytics/track', () => ({ track: (...args: unknown[]) => mockTrack(...args) }));

import { openFantasyHost } from '../deviceLinks';
import { LINK_FAILED_TITLE } from '../safeOpen';

const yahoo = { name: 'Yahoo', teamPage: false, url: 'https://hockey.fantasysports.yahoo.com/' };
const fail = () => Promise.reject(new Error('Unable to open URL'));

beforeEach(() => {
  jest.clearAllMocks();
  mockLinking.calls.length = 0;
  mockLinking.respond = () => Promise.resolve(true);
  mockBrowser.mockResolvedValue({ type: 'opened' });
});

function lastResult() {
  const [event, properties] = mockTrack.mock.calls[mockTrack.mock.calls.length - 1];
  expect(event).toBe('host_open_result');
  return properties.result;
}

describe('openFantasyHost', () => {
  it('hands the host link to iOS, which opens the host app or Safari', async () => {
    await expect(openFantasyHost(yahoo, 'lineup')).resolves.toBe('opened');
    expect(mockLinking.calls).toEqual([yahoo.url]);
    expect(mockBrowser).not.toHaveBeenCalled();
    expect(mockTrack).toHaveBeenNthCalledWith(1, 'host_open', { host: 'yahoo', team_page: false, source: 'lineup' });
    expect(lastResult()).toBe('opened');
  });

  it('falls back to the in-app browser when iOS refuses the link', async () => {
    mockLinking.respond = fail;
    await expect(openFantasyHost(yahoo, 'free_lineup_call')).resolves.toBe('in_app_browser');
    expect(mockBrowser).toHaveBeenCalledWith(yahoo.url);
    expect(mockAlert).not.toHaveBeenCalled();
    expect(lastResult()).toBe('in_app_browser');
  });

  it('tells the person where to go when no browser opens either', async () => {
    mockLinking.respond = fail;
    mockBrowser.mockImplementation(fail);
    await expect(openFantasyHost(yahoo, 'free_pickup')).resolves.toBe('alerted');
    expect(mockAlert).toHaveBeenCalledWith(LINK_FAILED_TITLE, `Visit ${yahoo.url} in your browser.`);
    expect(lastResult()).toBe('alerted');
  });

  it('sends one result per tap and no separate link_open_fallback event', async () => {
    mockLinking.respond = fail;
    await openFantasyHost(yahoo, 'lineup');
    expect(mockTrack.mock.calls.map(([event]) => event)).toEqual(['host_open', 'host_open_result']);
  });
});
