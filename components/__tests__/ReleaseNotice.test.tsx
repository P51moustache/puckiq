import React from 'react';
// @ts-expect-error react-test-renderer has no local type declarations
import { act, create } from 'react-test-renderer';
import type { ProStatus } from '../../services/subscription';
import { ReleaseNotice } from '../release/ReleaseNotice';
import { RELEASE_NOTICE_ID } from '../../constants/release';
import { RELEASE_NOTICE_KEY } from '../../services/releaseNotice';


const mockGetItem = jest.fn();
const mockSetItem = jest.fn().mockResolvedValue(undefined);
const mockDownload = jest.fn();
const mockRestore = jest.fn();
const mockApply = jest.fn();
let mockStatus: ProStatus = { isPro: true, source: 'loyalty', expiresAt: '2026-11-05T12:00:00Z', willRenew: false };
let mockLoading = false;

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true, default: { getItem: (...args: unknown[]) => mockGetItem(...args), setItem: (...args: unknown[]) => mockSetItem(...args) },
}));
jest.mock('../../services/subscription', () => ({
  getOriginalDownloadDate: () => mockDownload(), restorePurchases: () => mockRestore(),
}));
jest.mock('../SubscriptionProvider', () => ({ useSubscription: () => ({ status: mockStatus, loading: mockLoading, applyStatus: mockApply }) }));
jest.mock('react-native', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  const host = (name: string) => {
    const Component = ({ children, ...props }: any) => React.createElement(name, props, children);
    Component.displayName = name; return Component;
  };
  return { Modal: host('Modal'), ScrollView: host('ScrollView'), Text: host('Text'), View: host('View'), StyleSheet: { create: (value: unknown) => value }, Alert: { alert: jest.fn() } };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../coach/ui', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  return { colors: {}, display: () => ({}), BrandMark: () => null,
    PrimaryButton: (props: any) => React.createElement('Button', props),
    GhostButton: (props: any) => React.createElement('Button', props) };
});


async function render(hadSavedSetup = false, replay = false) {
  let tree: any;
  await act(async () => { tree = create(<ReleaseNotice hadSavedSetup={hadSavedSetup} replay={replay} />); });
  return tree;
}

describe('welcome-back delivery', () => {
  beforeEach(() => {
    jest.clearAllMocks(); mockLoading = false;
    mockGetItem.mockResolvedValue(null); mockDownload.mockResolvedValue('2026-09-29');
    mockStatus = { isPro: true, source: 'loyalty', expiresAt: '2026-11-05T12:00:00Z', willRenew: false };
  });

  it('explains the changed product and no-charge gift to a returning downloader', async () => {
    const tree = await render();
    const copy = JSON.stringify(tree.toJSON());
    expect(copy).toContain('Fantasy coaching replaces');
    expect(copy).toContain('30-day thank-you gift');
    expect(copy).toContain('no automatic charge');
  });

  it('waits for subscription initialization instead of showing the wrong loyalty status', async () => {
    mockLoading = true;
    const tree = await render(true);
    expect(tree.toJSON()).toBeNull();
    expect(mockDownload).not.toHaveBeenCalled();
  });

  it('persists acknowledgement and stays hidden after relaunch', async () => {
    const tree = await render();
    await act(async () => { await tree.root.findByProps({ testID: 'release-notice-continue' }).props.onPress(); });
    expect(mockSetItem).toHaveBeenCalledWith(RELEASE_NOTICE_KEY, RELEASE_NOTICE_ID);
    expect(tree.toJSON()).toBeNull();
    mockGetItem.mockResolvedValue(RELEASE_NOTICE_ID);
    expect((await render(true)).toJSON()).toBeNull();
  });

  it('does not show a welcome-back announcement to a new customer', async () => {
    mockDownload.mockResolvedValue('2026-10-08');
    expect((await render()).toJSON()).toBeNull();
  });

  it('lets Settings reopen the tour and explains permanent paid-buyer access', async () => {
    mockStatus = { isPro: true, source: 'legacy', expiresAt: null, willRenew: false };
    mockGetItem.mockResolvedValue(RELEASE_NOTICE_ID);
    expect(JSON.stringify((await render(true, true)).toJSON())).toContain('No end date or new subscription');
  });
});
