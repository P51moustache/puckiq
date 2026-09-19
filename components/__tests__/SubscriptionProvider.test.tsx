import React from 'react';
import renderer, { act } from 'react-test-renderer';

import { SubscriptionProvider, useSubscription } from '../SubscriptionProvider';

const mockAuth = { user: null as { id: string } | null };
const mockInitializeSubscription = jest.fn();
const mockSetSubscriptionUser = jest.fn();
const mockIsPro = jest.fn();
const mockSubscribeToCustomerInfo = jest.fn();
let capturedListeners: Array<(info: any) => void> = [];

jest.mock('../auth/AuthProvider', () => ({
  useAuthContext: () => mockAuth,
}));

jest.mock('../../services/subscription', () => ({
  hasProEntitlement: (customerInfo: any) => Boolean(customerInfo.entitlements.active.pro),
  initializeSubscription: (...args: any[]) => mockInitializeSubscription(...args),
  setSubscriptionUser: (...args: any[]) => mockSetSubscriptionUser(...args),
  isPro: (...args: any[]) => mockIsPro(...args),
  subscribeToCustomerInfo: (...args: any[]) => mockSubscribeToCustomerInfo(...args),
}));

jest.mock('../PaywallModal', () => ({
  __esModule: true,
  default: (props: any) => React.createElement('PaywallModal', props),
}));

function Probe() {
  const {
    isPremium,
    loading,
    showPaywall,
    refresh,
    subscriptionUnavailableReason,
  } = useSubscription();
  return React.createElement(
    'Probe',
    {
      testID: 'subscription-probe',
      onOpen: () => showPaywall('Fantasy Projections'),
      onRefresh: refresh,
      reason: subscriptionUnavailableReason,
    },
    `${isPremium}:${loading}`,
  );
}

function customerInfo(active: boolean) {
  return { entitlements: { active: active ? { pro: { isActive: true } } : {} } };
}

describe('SubscriptionProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedListeners = [];
    mockAuth.user = { id: 'user-1' };
    mockInitializeSubscription.mockResolvedValue(true);
    mockSetSubscriptionUser.mockResolvedValue(customerInfo(true));
    mockIsPro.mockResolvedValue(true);
    mockSubscribeToCustomerInfo.mockReturnValue(jest.fn());
  });

  it('synchronizes the authenticated identity and owns one paywall opener', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <SubscriptionProvider><Probe /></SubscriptionProvider>,
      );
    });

    expect(mockInitializeSubscription).toHaveBeenCalledTimes(1);
    expect(mockSetSubscriptionUser).toHaveBeenCalledWith('user-1');
    expect(tree!.root.findByType('PaywallModal' as any).props.visible).toBe(false);

    await act(async () => {
      tree!.root.findByProps({ testID: 'subscription-probe' }).props.onOpen();
    });

    expect(tree!.root.findByType('PaywallModal' as any).props).toMatchObject({
      visible: true,
      featureHeadline: 'Fantasy Projections',
    });
  });

  it('closes the provider paywall before a new identity is confirmed', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<SubscriptionProvider><Probe /></SubscriptionProvider>);
    });

    await act(async () => {
      tree!.root.findByProps({ testID: 'subscription-probe' }).props.onOpen();
    });
    expect(tree!.root.findByType('PaywallModal' as any).props.visible).toBe(true);

    mockAuth.user = { id: 'user-2' };
    mockSetSubscriptionUser.mockReturnValueOnce(new Promise(() => undefined));
    await act(async () => {
      tree!.update(<SubscriptionProvider><Probe /></SubscriptionProvider>);
    });

    expect(tree!.root.findByType('PaywallModal' as any).props.visible).toBe(false);
  });

  it('reports missing SDK configuration and keeps the default opener closed', async () => {
    mockInitializeSubscription.mockResolvedValueOnce(false);
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<SubscriptionProvider><Probe /></SubscriptionProvider>);
    });

    const probe = tree!.root.findByProps({ testID: 'subscription-probe' });
    expect(probe.props.reason).toBe('RevenueCat is not configured for this platform.');
    await act(async () => { probe.props.onOpen(); });
    expect(tree!.root.findByType('PaywallModal' as any).props.visible).toBe(false);
    expect(mockSetSubscriptionUser).not.toHaveBeenCalled();
  });

  it('reports failed identity confirmation without exposing purchase actions', async () => {
    mockSetSubscriptionUser.mockRejectedValueOnce(new Error('identity rejected'));
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<SubscriptionProvider><Probe /></SubscriptionProvider>);
    });

    const probe = tree!.root.findByProps({ testID: 'subscription-probe' });
    expect(probe.props.reason).toBe('Subscription identity could not be confirmed.');
    await act(async () => { probe.props.onOpen(); });
    expect(tree!.root.findByType('PaywallModal' as any).props.visible).toBe(false);
  });

  it('fails closed when customer-info listener registration throws', async () => {
    mockSubscribeToCustomerInfo.mockImplementationOnce(() => {
      throw new Error('listener registration failed');
    });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<SubscriptionProvider><Probe /></SubscriptionProvider>);
    });

    const probe = tree!.root.findByProps({ testID: 'subscription-probe' });
    expect(probe.props.reason).toBe('Subscription identity could not be confirmed.');
    expect(probe.props.children).toBe('false:false');
    await act(async () => { probe.props.onOpen(); });
    expect(tree!.root.findByType('PaywallModal' as any).props.visible).toBe(false);
  });

  it('logs out and closes premium access before a signed-out account can render stale access', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <SubscriptionProvider><Probe /></SubscriptionProvider>,
      );
    });

    mockAuth.user = null;
    mockSetSubscriptionUser.mockResolvedValueOnce(customerInfo(false));
    await act(async () => {
      tree!.update(<SubscriptionProvider><Probe /></SubscriptionProvider>);
    });

    expect(mockSetSubscriptionUser).toHaveBeenLastCalledWith(undefined);
    expect(tree!.root.findByProps({ testID: 'subscription-probe' }).props.children).toBe('false:false');
  });

  it('ignores customer-info updates from a cleaned-up account listener', async () => {
    mockSubscribeToCustomerInfo.mockImplementation((listener) => {
      capturedListeners.push(listener);
      return jest.fn();
    });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <SubscriptionProvider><Probe /></SubscriptionProvider>,
      );
    });

    mockAuth.user = { id: 'user-2' };
    mockSetSubscriptionUser.mockResolvedValueOnce(customerInfo(false));
    await act(async () => {
      tree!.update(<SubscriptionProvider><Probe /></SubscriptionProvider>);
    });

    await act(async () => {
      capturedListeners[0](customerInfo(true));
    });

    expect(tree!.root.findByProps({ testID: 'subscription-probe' }).props.children).toBe('false:false');
  });

  it('waits for identity confirmation before registering or accepting a customer-info listener', async () => {
    let resolveIdentity!: (info: any) => void;
    mockSetSubscriptionUser.mockReturnValueOnce(new Promise((resolve) => { resolveIdentity = resolve; }));

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<SubscriptionProvider><Probe /></SubscriptionProvider>);
    });

    expect(mockSubscribeToCustomerInfo).not.toHaveBeenCalled();
    await act(async () => {
      tree!.root.findByProps({ testID: 'subscription-probe' }).props.onOpen();
    });
    expect(tree!.root.findByType('PaywallModal' as any).props.visible).toBe(false);

    resolveIdentity(customerInfo(true));
    await act(async () => { await Promise.resolve(); });

    expect(mockSubscribeToCustomerInfo).toHaveBeenCalledTimes(1);
    expect(tree!.root.findByProps({ testID: 'subscription-probe' }).props.children).toBe('true:false');
  });

  it('does not perform side effects when deferred initialization finishes after rerender', async () => {
    let resolveInitialization!: (configured: boolean) => void;
    const deferredInitialization = new Promise<boolean>((resolve) => { resolveInitialization = resolve; });
    mockInitializeSubscription
      .mockImplementationOnce(() => deferredInitialization)
      .mockResolvedValueOnce(false);

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<SubscriptionProvider><Probe /></SubscriptionProvider>);
    });

    mockAuth.user = { id: 'user-2' };
    await act(async () => {
      tree!.update(<SubscriptionProvider><Probe /></SubscriptionProvider>);
    });
    await act(async () => { tree!.unmount(); });
    resolveInitialization(true);
    await act(async () => { await Promise.resolve(); });

    expect(mockSubscribeToCustomerInfo).not.toHaveBeenCalled();
    expect(mockSetSubscriptionUser).not.toHaveBeenCalled();
  });

  it('ignores a stale refresh result after the desired user changes', async () => {
    let resolveRefresh!: (pro: boolean) => void;
    mockIsPro.mockReturnValueOnce(new Promise((resolve) => { resolveRefresh = resolve; }));

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<SubscriptionProvider><Probe /></SubscriptionProvider>);
    });

    const refresh = tree!.root.findByProps({ testID: 'subscription-probe' }).props.onRefresh();
    mockAuth.user = { id: 'user-2' };
    mockSetSubscriptionUser.mockResolvedValueOnce(customerInfo(false));
    await act(async () => {
      tree!.update(<SubscriptionProvider><Probe /></SubscriptionProvider>);
    });
    resolveRefresh(true);
    await refresh;

    expect(tree!.root.findByProps({ testID: 'subscription-probe' }).props.children).toBe('false:false');
  });

  it('ignores a listener event while switching identities', async () => {
    mockSubscribeToCustomerInfo.mockImplementation((listener) => {
      capturedListeners.push(listener);
      return jest.fn();
    });
    let resolveIdentity!: (info: any) => void;
    mockSetSubscriptionUser.mockReturnValueOnce(new Promise((resolve) => { resolveIdentity = resolve; }));

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<SubscriptionProvider><Probe /></SubscriptionProvider>);
    });
    resolveIdentity(customerInfo(true));
    await act(async () => { await Promise.resolve(); });

    mockAuth.user = { id: 'user-2' };
    mockSetSubscriptionUser.mockReturnValueOnce(new Promise(() => undefined));
    await act(async () => {
      tree!.update(<SubscriptionProvider><Probe /></SubscriptionProvider>);
    });
    capturedListeners[0](customerInfo(true));

    expect(tree!.root.findByProps({ testID: 'subscription-probe' }).props.children).toBe('false:true');
  });

  it('cleans up a listener when unmounted after identity confirmation', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<SubscriptionProvider><Probe /></SubscriptionProvider>);
    });
    await act(async () => { tree!.unmount(); });

    expect(mockSubscribeToCustomerInfo).toHaveBeenCalledTimes(1);
    expect(mockSubscribeToCustomerInfo.mock.results[0].value).toHaveBeenCalledTimes(1);
  });
});
