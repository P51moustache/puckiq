import { useHaptics } from '../useHaptics';

// expo-haptics is already mocked in jest.setup.js
// We need to add the enum constants for our tests
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
  NotificationFeedbackType: { Success: 'Success', Error: 'Error', Warning: 'Warning' },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

const Haptics = require('expo-haptics');
const { Platform } = require('react-native');

describe('useHaptics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'ios';
  });

  describe('on iOS', () => {
    it('tap calls impactAsync with Light style', () => {
      const { tap } = useHaptics();
      tap();
      expect(Haptics.impactAsync).toHaveBeenCalledWith('Light');
    });

    it('press calls impactAsync with Medium style', () => {
      const { press } = useHaptics();
      press();
      expect(Haptics.impactAsync).toHaveBeenCalledWith('Medium');
    });

    it('success calls notificationAsync with Success type', () => {
      const { success } = useHaptics();
      success();
      expect(Haptics.notificationAsync).toHaveBeenCalledWith('Success');
    });

    it('selection calls selectionAsync', () => {
      const { selection } = useHaptics();
      selection();
      expect(Haptics.selectionAsync).toHaveBeenCalled();
    });
  });

  describe('on Android', () => {
    beforeEach(() => {
      Platform.OS = 'android';
    });

    it('tap fires on Android', () => {
      const { tap } = useHaptics();
      tap();
      expect(Haptics.impactAsync).toHaveBeenCalledWith('Light');
    });
  });

  describe('on web (unsupported)', () => {
    beforeEach(() => {
      Platform.OS = 'web';
    });

    it('tap does not call Haptics', () => {
      const { tap } = useHaptics();
      tap();
      expect(Haptics.impactAsync).not.toHaveBeenCalled();
    });

    it('press does not call Haptics', () => {
      const { press } = useHaptics();
      press();
      expect(Haptics.impactAsync).not.toHaveBeenCalled();
    });

    it('success does not call Haptics', () => {
      const { success } = useHaptics();
      success();
      expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    });

    it('selection does not call Haptics', () => {
      const { selection } = useHaptics();
      selection();
      expect(Haptics.selectionAsync).not.toHaveBeenCalled();
    });
  });
});
