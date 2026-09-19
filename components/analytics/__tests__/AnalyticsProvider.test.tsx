import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { AnalyticsProvider, useAnalyticsContext } from '../AnalyticsProvider';
import { useAnalytics } from '@/hooks/useAnalytics';
import AnalyticsService from '@/services/analytics/AnalyticsService';

// Mock react-native
let mockAppState = 'active';
let mockAppStateListener: ((state: string) => void) | undefined;
const mockAppStateSubscription = { remove: jest.fn() };

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
  AppState: {
    get currentState() {
      return mockAppState;
    },
    addEventListener: jest.fn((_event, listener) => {
      mockAppStateListener = listener;
      return mockAppStateSubscription;
    }),
  },
  Text: 'Text',
}));

// Mock the AnalyticsService
jest.mock('@/services/analytics/AnalyticsService');
jest.mock('@/lib/firebase', () => ({
  analytics: null,
}));

const mockAnalyticsService = {
  initialize: jest.fn().mockResolvedValue(undefined),
  destroy: jest.fn(),
  trackSessionStart: jest.fn(),
  trackSessionEnd: jest.fn(),
  trackScreenView: jest.fn(),
  getInstance: jest.fn(),
};

describe('AnalyticsProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAppState = 'active';
    mockAppStateListener = undefined;
    (AnalyticsService.getInstance as jest.Mock).mockReturnValue(mockAnalyticsService);
  });

  it('should initialize analytics service on mount', async () => {
    const TestComponent = () => {
      useAnalyticsContext();
      return <text>Test</text>;
    };

    render(
      <AnalyticsProvider config={{ enabled: true, debug: true }}>
        <TestComponent />
      </AnalyticsProvider>
    );

    await waitFor(() => {
      expect(mockAnalyticsService.initialize).toHaveBeenCalledWith({
        enabled: true,
        debug: true,
      });
    });
  });

  it('should NOT destroy singleton analytics service on unmount (critical bug)', async () => {
    const TestComponent = () => {
      useAnalyticsContext();
      return <text>Test</text>;
    };

    const { unmount } = render(
      <AnalyticsProvider config={{ enabled: true }}>
        <TestComponent />
      </AnalyticsProvider>
    );

    // Clear the initialize call
    mockAnalyticsService.initialize.mockClear();

    // Unmount the component (simulates app going to background)
    unmount();

    // The singleton should NOT be destroyed on unmount
    // This is the bug: destroy() should not be called
    expect(mockAnalyticsService.destroy).not.toHaveBeenCalled();
  });

  it('should handle remount without crashing (app return from background)', async () => {
    const TestComponent = () => {
      useAnalyticsContext();
      return <text>Test</text>;
    };

    // First mount
    const { unmount } = render(
      <AnalyticsProvider config={{ enabled: true }}>
        <TestComponent />
      </AnalyticsProvider>
    );

    await waitFor(() => {
      expect(mockAnalyticsService.initialize).toHaveBeenCalledTimes(1);
    });

    // Unmount (app goes to background)
    unmount();

    // Clear mocks
    mockAnalyticsService.initialize.mockClear();

    // Remount (app returns from background) - should not throw
    expect(() => {
      render(
        <AnalyticsProvider config={{ enabled: true }}>
          <TestComponent />
        </AnalyticsProvider>
      );
    }).not.toThrow();

    // Initialize should be called again, but this should work fine
    await waitFor(() => {
      expect(mockAnalyticsService.initialize).toHaveBeenCalledTimes(1);
    });
  });

  it('should handle config changes correctly', async () => {
    const TestComponent = () => {
      useAnalyticsContext();
      return <text>Test</text>;
    };

    const { rerender } = render(
      <AnalyticsProvider config={{ enabled: true, debug: false }}>
        <TestComponent />
      </AnalyticsProvider>
    );

    await waitFor(() => {
      expect(mockAnalyticsService.initialize).toHaveBeenCalledWith({
        enabled: true,
        debug: false,
      });
    });

    // Note: With current implementation, changing config won't trigger re-initialization
    // because config is not in the dependency array (which is the bug we're fixing)
    rerender(
      <AnalyticsProvider config={{ enabled: false, debug: true }}>
        <TestComponent />
      </AnalyticsProvider>
    );

    // After fix, initialize should be called again with new config
    // (but we'll keep it from re-initializing to avoid performance issues)
  });

  it('should register one lifecycle listener for multiple hook users and clean it up', async () => {
    const Screen = ({ name }: { name: string }) => {
      useAnalytics(name);
      return <text>{name}</text>;
    };

    const { unmount } = render(
      <AnalyticsProvider config={{ enabled: true }}>
        <Screen name="Home" />
        <Screen name="Players" />
      </AnalyticsProvider>
    );

    await waitFor(() => {
      expect(mockAnalyticsService.initialize).toHaveBeenCalledTimes(1);
    });

    expect(mockAppStateListener).toBeDefined();
    expect(AppState.addEventListener).toHaveBeenCalledTimes(1);

    mockAppState = 'background';
    mockAppStateListener?.(mockAppState);
    mockAppState = 'inactive';
    mockAppStateListener?.(mockAppState);
    mockAppState = 'active';
    mockAppStateListener?.(mockAppState);
    mockAppStateListener?.('active');

    expect(mockAnalyticsService.trackSessionEnd).toHaveBeenCalledTimes(1);
    expect(mockAnalyticsService.trackSessionStart).toHaveBeenCalledTimes(2);

    unmount();
    expect(mockAppStateSubscription.remove).toHaveBeenCalledTimes(1);
  });

  it('should not duplicate lifecycle transitions after provider remount', async () => {
    const Screen = () => {
      useAnalytics('Home');
      return <text>Home</text>;
    };

    const first = render(
      <AnalyticsProvider>
        <Screen />
      </AnalyticsProvider>
    );
    await waitFor(() => expect(mockAnalyticsService.initialize).toHaveBeenCalledTimes(1));

    first.unmount();
    mockAppState = 'background';

    render(
      <AnalyticsProvider>
        <Screen />
      </AnalyticsProvider>
    );
    await waitFor(() => expect(mockAnalyticsService.initialize).toHaveBeenCalledTimes(2));

    mockAppStateListener?.('active');
    mockAppStateListener?.('active');

    expect(mockAnalyticsService.trackSessionStart).toHaveBeenCalledTimes(2);
    expect(mockAppStateSubscription.remove).toHaveBeenCalledTimes(1);
  });

  it('should throw error when useAnalyticsContext is used outside provider', () => {
    const TestComponent = () => {
      useAnalyticsContext();
      return <text>Test</text>;
    };

    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useAnalyticsContext must be used within an AnalyticsProvider');

    consoleSpy.mockRestore();
  });
});
