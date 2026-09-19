import { initializeNotificationsIfSupported } from '../runtimeCapabilities';

describe('runtime capabilities', () => {
  it('does not import notifications on Android Expo Go', async () => {
    const load = jest.fn();
    await expect(initializeNotificationsIfSupported('android', 'expo', load)).resolves.toBe(false);
    expect(load).not.toHaveBeenCalled();
  });

  it.each([
    ['ios', 'expo'],
    ['android', 'standalone'],
  ])('initializes notifications for supported %s/%s runtimes', async (platform, ownership) => {
    const initializeNotifications = jest.fn().mockResolvedValue(undefined);
    const load = jest.fn().mockResolvedValue({ initializeNotifications });
    await expect(initializeNotificationsIfSupported(platform, ownership, load)).resolves.toBe(true);
    expect(initializeNotifications).toHaveBeenCalledTimes(1);
  });
});
