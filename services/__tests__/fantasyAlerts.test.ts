import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getDismissedAlertIds,
  dismissAlert,
  getSavedAlertIds,
  saveAlert,
  getAlertColor,
} from '../fantasyAlerts';

describe('fantasyAlerts', () => {
  beforeEach(() => {
    (AsyncStorage.getItem as jest.Mock).mockReset();
    (AsyncStorage.setItem as jest.Mock).mockReset();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  it('returns empty dismissed list initially', async () => {
    const ids = await getDismissedAlertIds();
    expect(ids).toEqual([]);
  });

  it('dismisses an alert', async () => {
    await dismissAlert('alert-1');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'puckiq_dismissed_alerts',
      JSON.stringify(['alert-1'])
    );
  });

  it('does not duplicate dismissed alerts', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(['alert-1']));
    await dismissAlert('alert-1');
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('returns empty saved list initially', async () => {
    const ids = await getSavedAlertIds();
    expect(ids).toEqual([]);
  });

  it('saves an alert', async () => {
    await saveAlert('alert-2');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'puckiq_saved_alerts',
      JSON.stringify(['alert-2'])
    );
  });

  it('does not duplicate saved alerts', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(['alert-2']));
    await saveAlert('alert-2');
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('returns correct color for injury type', () => {
    expect(getAlertColor('injury')).toBe('#e63946');
  });

  it('returns correct color for goalie type', () => {
    expect(getAlertColor('goalie')).toBe('#06d6a0');
  });

  it('returns correct color for lineup type', () => {
    expect(getAlertColor('lineup')).toBe('#ffd60a');
  });
});
