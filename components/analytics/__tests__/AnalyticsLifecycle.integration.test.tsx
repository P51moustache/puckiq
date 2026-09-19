import React from 'react';
import { act, render } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AnalyticsProvider } from '../AnalyticsProvider';
import { useAnalytics } from '@/hooks/useAnalytics';
import AnalyticsService from '@/services/analytics/AnalyticsService';

let mockAppState = 'active';
let mockAppStateListener: ((state: string) => void) | undefined;

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  AppState: {
    get currentState() {
      return mockAppState;
    },
    addEventListener: jest.fn((_event, listener) => {
      mockAppStateListener = listener;
      return { remove: jest.fn() };
    }),
  },
}));

const service = AnalyticsService.getInstance();
const storage = new Map<string, string>();

function Screen() {
  useAnalytics('ColdForeground');
  return <text>Screen</text>;
}

function ConditionalScreen({ visible }: { visible: boolean }) {
  return visible ? <Screen /> : null;
}

async function settleInitialization() {
  await act(async () => {
    await new Promise<void>((resolve) => setImmediate(resolve));
    await new Promise<void>((resolve) => setImmediate(resolve));
  });
}

describe('analytics lifecycle integration', () => {
  beforeEach(() => {
    service.destroy();
    storage.clear();
    jest.clearAllMocks();
    mockAppState = 'active';
    mockAppStateListener = undefined;
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) =>
      Promise.resolve(storage.get(key) ?? null)
    );
    (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
      storage.set(key, value);
      return Promise.resolve();
    });
  });

  afterEach(() => {
    service.destroy();
  });

  it('starts a cold foreground session and resynchronizes after background remount', async () => {
    const first = render(
      <AnalyticsProvider config={{ enabled: true, debug: false }}>
        <Screen />
      </AnalyticsProvider>
    );
    await settleInitialization();
    await service.flush();

    let events = JSON.parse(storage.get('analytics_events') ?? '[]');
    expect(events.filter((event: any) => event.event === 'session_start')).toHaveLength(1);
    expect(events.filter((event: any) => event.event === 'screen_view')).toHaveLength(1);

    first.unmount();
    mockAppState = 'background';

    const second = render(
      <AnalyticsProvider config={{ enabled: true, debug: false }}>
        <Screen />
      </AnalyticsProvider>
    );
    await settleInitialization();
    await service.flush();

    events = JSON.parse(storage.get('analytics_events') ?? '[]');
    expect(events.filter((event: any) => event.event === 'session_start')).toHaveLength(1);
    expect(events.filter((event: any) => event.event === 'session_end')).toHaveLength(1);

    mockAppState = 'active';
    mockAppStateListener?.('active');
    await service.flush();
    events = JSON.parse(storage.get('analytics_events') ?? '[]');
    expect(events.filter((event: any) => event.event === 'session_start')).toHaveLength(2);

    second.unmount();
  });

  it('does not track a screen that unmounts before initialization completes', async () => {
    let resolveConfig!: (value: string | null) => void;
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === 'analytics_config') {
        return new Promise<string | null>((resolve) => {
          resolveConfig = resolve;
        });
      }
      return Promise.resolve(null);
    });

    const rendered = render(
      <AnalyticsProvider config={{ enabled: true, debug: false }}>
        <ConditionalScreen visible />
      </AnalyticsProvider>
    );
    rendered.rerender(
      <AnalyticsProvider config={{ enabled: true, debug: false }}>
        <ConditionalScreen visible={false} />
      </AnalyticsProvider>
    );

    resolveConfig(null);
    await settleInitialization();
    await service.flush();

    const events = JSON.parse(storage.get('analytics_events') ?? '[]');
    expect(events.filter((event: any) => event.event === 'screen_view')).toHaveLength(0);
  });

  it('keeps a persisted opt-out across a default-enabled provider remount', async () => {
    const first = render(
      <AnalyticsProvider config={{ enabled: true, debug: false }}>
        <Screen />
      </AnalyticsProvider>
    );
    await settleInitialization();
    service.setEnabled(false);
    first.unmount();

    render(
      <AnalyticsProvider config={{ enabled: true, debug: false }}>
        <Screen />
      </AnalyticsProvider>
    );
    await settleInitialization();
    service.trackCustomEvent('disabled_event');
    await service.flush();

    const events = JSON.parse(storage.get('analytics_events') ?? '[]');
    expect(events.filter((event: any) => event.event === 'disabled_event')).toHaveLength(0);
    expect((service as any).flushTimer).toBeUndefined();
  });
});
