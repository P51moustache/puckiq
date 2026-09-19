type NotificationModule = { initializeNotifications: () => Promise<void> };

export async function initializeNotificationsIfSupported(
  platform: string,
  appOwnership: string | null | undefined,
  load: () => Promise<NotificationModule>,
): Promise<boolean> {
  if (platform === 'android' && appOwnership === 'expo') return false;
  const notifications = await load();
  await notifications.initializeNotifications();
  return true;
}
