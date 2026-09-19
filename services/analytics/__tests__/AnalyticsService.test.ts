import AsyncStorage from '@react-native-async-storage/async-storage';
import AnalyticsService from '../AnalyticsService';

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

const service = AnalyticsService.getInstance();

describe('AnalyticsService lifecycle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    service.destroy();
    (service as any).eventQueue = [];
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    service.destroy();
    jest.restoreAllMocks();
    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
  });

  it('measures a session from foreground start through background end', async () => {
    jest.setSystemTime(1_000);
    await service.initialize({ enabled: true, debug: false, flushInterval: 60_000 });

    jest.spyOn(service, 'flush').mockResolvedValue();
    service.trackSessionStart();
    jest.setSystemTime(4_000);
    service.trackUserAction('tap', 'test');
    jest.setSystemTime(7_000);
    service.trackSessionEnd();

    const events = (service as any).eventQueue;
    expect(events.find((event: any) => event.event === 'session_end')).toEqual(
      expect.objectContaining({
        properties: { session_duration: 6_000 },
      })
    );
  });

  it('ignores repeated session transitions while preserving one active session', async () => {
    await service.initialize({ enabled: true, debug: false, flushInterval: 60_000 });

    jest.spyOn(service, 'flush').mockResolvedValue();
    service.trackSessionStart();
    service.trackSessionStart();
    service.trackSessionEnd();
    service.trackSessionEnd();

    const events = (service as any).eventQueue;
    expect(events.filter((event: any) => event.event === 'session_start')).toHaveLength(1);
    expect(events.filter((event: any) => event.event === 'session_end')).toHaveLength(1);
  });

  it('applies enabled config changes after initialization', async () => {
    await service.initialize({ enabled: false, debug: false, flushInterval: 60_000 });
    service.trackSessionStart();
    expect((service as any).eventQueue).toHaveLength(0);

    await service.initialize({ enabled: true });
    service.trackSessionStart();

    expect((service as any).eventQueue.filter((event: any) => event.event === 'session_start')).toHaveLength(1);
  });

  it('does not accept lifecycle events before persisted config is loaded', async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === 'analytics_config') {
        return Promise.resolve(JSON.stringify({ enabled: false }));
      }
      return Promise.resolve(null);
    });

    const initialization = service.initialize({ enabled: true, debug: false, flushInterval: 60_000 });
    service.trackSessionStart();
    await initialization;

    expect((service as any).eventQueue).toHaveLength(0);
  });

  it('stops accepting and flushing events when disabled, then restarts explicitly', async () => {
    await service.initialize({ enabled: true, debug: false, flushInterval: 60_000 });
    service.trackSessionStart();
    expect((service as any).eventQueue).toHaveLength(1);

    service.setEnabled(false);
    await service.flush();

    expect((service as any).eventQueue).toHaveLength(0);
    expect(jest.getTimerCount()).toBe(0);
    expect(
      (AsyncStorage.setItem as jest.Mock).mock.calls.some(([key]) => key === 'analytics_events')
    ).toBe(false);

    service.setEnabled(true);
    expect(jest.getTimerCount()).toBe(1);
    service.trackSessionStart();
    expect((service as any).eventQueue).toHaveLength(1);
  });

  it('stops the timer when an initialized config disables analytics', async () => {
    await service.initialize({ enabled: true, debug: false, flushInterval: 60_000 });
    expect(jest.getTimerCount()).toBe(1);

    await service.initialize({ enabled: false });

    expect(jest.getTimerCount()).toBe(0);
  });

  it('does not persist an in-flight flush after analytics is disabled', async () => {
    await service.initialize({ enabled: true, debug: false, flushInterval: 60_000 });
    service.trackSessionStart();

    let resolveEvents!: (value: string | null) => void;
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === 'analytics_events') {
        return new Promise<string | null>((resolve) => {
          resolveEvents = resolve;
        });
      }
      return Promise.resolve(null);
    });

    const flushing = service.flush();
    service.setEnabled(false);
    resolveEvents(null);
    await flushing;

    expect(
      (AsyncStorage.setItem as jest.Mock).mock.calls.some(([key]) => key === 'analytics_events')
    ).toBe(false);
  });

  it('rejects events and flushes before initialization', async () => {
    service.trackCustomEvent('before_init');
    await service.flush();

    expect((service as any).eventQueue).toHaveLength(0);
    expect(
      (AsyncStorage.setItem as jest.Mock).mock.calls.some(([key]) => key === 'analytics_events')
    ).toBe(false);
  });

  it('does not resurrect initialization or its timer after destroy', async () => {
    let resolveConfig!: (value: string | null) => void;
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === 'analytics_config') {
        return new Promise<string | null>((resolve) => {
          resolveConfig = resolve;
        });
      }
      return Promise.resolve(null);
    });

    const initialization = service.initialize({ enabled: true, debug: false, flushInterval: 60_000 });
    service.destroy();
    resolveConfig(null);
    await initialization;

    expect((service as any).initialized).toBe(false);
    expect((service as any).flushTimer).toBeUndefined();
    expect(jest.getTimerCount()).toBe(0);
  });
});
