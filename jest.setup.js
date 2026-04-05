// Disable Expo winter runtime for tests
process.env.EXPO_USE_WINTER = 'false';
process.env.EXPO_USE_METRO_WORKSPACE_ROOT = 'false';

// Mock Expo winter/metro runtime
jest.mock('expo/src/winter/installGlobal', () => ({}), { virtual: true });
jest.mock('expo/src/winter/runtime.native', () => ({}), { virtual: true });
jest.mock('@expo/metro-runtime', () => ({}), { virtual: true });

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  multiSet: jest.fn(() => Promise.resolve()),
  multiGet: jest.fn(() => Promise.resolve([])),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  clear: jest.fn(() => Promise.resolve()),
}));

// Mock Supabase client — chainable query builder that resolves to empty data
jest.mock('./lib/supabase', () => {
  function createQueryBuilder() {
    const result = { data: [], error: null };
    const builder = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn(() => Promise.resolve({ data: null, error: null })),
      // Make the builder itself thenable so `await supabase.from(x).select().eq()` works
      then: (resolve) => Promise.resolve(result).then(resolve),
    };
    // Each chainable method should return the same builder
    for (const method of ['select', 'insert', 'upsert', 'update', 'delete', 'eq', 'neq', 'in', 'gte', 'lte', 'or', 'order', 'limit']) {
      builder[method].mockReturnValue(builder);
    }
    return builder;
  }
  return {
    supabase: {
      from: jest.fn(() => createQueryBuilder()),
    },
  };
});

// Mock Firebase
jest.mock('./lib/firebase', () => ({
  analytics: {
    logEvent: jest.fn(),
  },
}));

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
}));

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('notification-id')),
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  getAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve([])),
  setNotificationHandler: jest.fn(),
}));

// Mock react-native-chart-kit
jest.mock('react-native-chart-kit', () => ({
  LineChart: 'LineChart',
  BarChart: 'BarChart',
}));

// Mock react-native-view-shot
jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn(() => Promise.resolve('/tmp/capture.png')),
}), { virtual: true });

// Mock react-native-purchases
jest.mock('react-native-purchases', () => ({
  default: {
    configure: jest.fn(),
    getOfferings: jest.fn(() => Promise.resolve({ current: null })),
    getCustomerInfo: jest.fn(() => Promise.resolve({ entitlements: { active: {} } })),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(() => Promise.resolve({ entitlements: { active: {} } })),
  },
}), { virtual: true });

// Mock react-native-google-mobile-ads
jest.mock('react-native-google-mobile-ads', () => ({
  BannerAd: 'BannerAd',
  BannerAdSize: { ANCHORED_ADAPTIVE_BANNER: 'ANCHORED_ADAPTIVE_BANNER' },
  TestIds: { BANNER: 'ca-app-pub-3940256099942544/6300978111' },
}), { virtual: true });

// Silence console.logs in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
};
