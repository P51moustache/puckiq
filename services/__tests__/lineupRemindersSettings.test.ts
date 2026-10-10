import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_REMINDERS, getReminderSettings } from '../lineupReminders';

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

const getItem = AsyncStorage.getItem as jest.Mock;

describe('getReminderSettings', () => {
  it('only reminds when the lineup needs a change by default', async () => {
    getItem.mockResolvedValueOnce(null);
    expect(await getReminderSettings()).toEqual(DEFAULT_REMINDERS);
    expect(DEFAULT_REMINDERS.onlyWhenNeeded).toBe(true);
  });

  it('turns it on for settings saved before it existed, and keeps a choice to turn it off', async () => {
    getItem.mockResolvedValueOnce(JSON.stringify({ enabled: true, minutesBefore: 30, liveStart: true }));
    expect(await getReminderSettings()).toEqual({ enabled: true, minutesBefore: 30, liveStart: true, onlyWhenNeeded: true });
    getItem.mockResolvedValueOnce(JSON.stringify({ enabled: true, minutesBefore: 30, liveStart: true, onlyWhenNeeded: false }));
    expect((await getReminderSettings()).onlyWhenNeeded).toBe(false);
  });
});
