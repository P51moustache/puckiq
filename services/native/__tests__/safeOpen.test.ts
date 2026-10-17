import {
  LINK_FAILED_TITLE,
  SETTINGS_FAILED_MESSAGE,
  SETTINGS_FAILED_TITLE,
  openAppSettings,
  openWebLink,
} from '../safeOpen';

const PRIVACY = 'https://p51moustache.github.io/puckiq/privacy.html';
const fail = () => Promise.reject(new Error('Unable to open URL'));

function webDeps(overrides: Partial<Parameters<typeof openWebLink>[1]> = {}) {
  return {
    openUrl: jest.fn().mockResolvedValue(true),
    openInAppBrowser: jest.fn().mockResolvedValue({ type: 'opened' }),
    alert: jest.fn(),
    ...overrides,
  };
}

describe('openWebLink', () => {
  it('opens in the system browser when iOS can', async () => {
    const deps = webDeps();
    await expect(openWebLink(PRIVACY, deps)).resolves.toBe('opened');
    expect(deps.openUrl).toHaveBeenCalledWith(PRIVACY);
    expect(deps.openInAppBrowser).not.toHaveBeenCalled();
    expect(deps.alert).not.toHaveBeenCalled();
  });

  it('falls back to the in-app browser when the system open fails', async () => {
    const deps = webDeps({ openUrl: jest.fn(fail) });
    await expect(openWebLink(PRIVACY, deps)).resolves.toBe('in_app_browser');
    expect(deps.openInAppBrowser).toHaveBeenCalledWith(PRIVACY);
    expect(deps.alert).not.toHaveBeenCalled();
  });

  it('shows the URL in an alert when both opens fail, without rejecting', async () => {
    const deps = webDeps({ openUrl: jest.fn(fail), openInAppBrowser: jest.fn(fail) });
    await expect(openWebLink(PRIVACY, deps)).resolves.toBe('alerted');
    expect(deps.alert).toHaveBeenCalledWith(LINK_FAILED_TITLE, expect.stringContaining(PRIVACY));
  });

  it('skips the in-app browser for non-web links', async () => {
    const deps = webDeps({ openUrl: jest.fn(fail) });
    await expect(openWebLink('mailto:zlce.app@gmail.com?subject=PuckIQ 3.3.0', deps)).resolves.toBe('alerted');
    expect(deps.openInAppBrowser).not.toHaveBeenCalled();
    expect(deps.alert).toHaveBeenCalledWith(LINK_FAILED_TITLE, 'Email zlce.app@gmail.com from your mail app.');
  });
});

describe('openAppSettings', () => {
  it('opens iOS Settings when it can', async () => {
    const deps = { openSettings: jest.fn().mockResolvedValue(undefined), alert: jest.fn() };
    await expect(openAppSettings(deps)).resolves.toBe('opened');
    expect(deps.alert).not.toHaveBeenCalled();
  });

  it('tells the person where to go when iOS refuses, without rejecting', async () => {
    const deps = { openSettings: jest.fn(() => Promise.reject(new Error('Unable to open app settings'))), alert: jest.fn() };
    await expect(openAppSettings(deps)).resolves.toBe('alerted');
    expect(deps.alert).toHaveBeenCalledWith(SETTINGS_FAILED_TITLE, SETTINGS_FAILED_MESSAGE);
  });
});
