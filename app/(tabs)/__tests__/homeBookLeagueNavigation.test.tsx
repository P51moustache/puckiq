import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('react-native', () => ({
  View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', ActivityIndicator: 'ActivityIndicator', RefreshControl: 'RefreshControl',
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  Alert: { alert: jest.fn() },
  BackHandler: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('expo-haptics', () => ({ notificationAsync: jest.fn(), NotificationFeedbackType: { Success: 'success' } }));

const router = { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: jest.fn() };
let routeParams: Record<string, string | undefined> = {};
jest.mock('expo-router', () => ({
  router,
  useLocalSearchParams: () => routeParams,
  usePathname: () => '/',
  useFocusEffect: (callback: () => void | (() => void)) => React.useEffect(callback, [callback]),
}));
jest.mock('../../../components/arena/ArenaProvider', () => ({ useArena: () => ({ palette: { page: '#fff', paper: '#fff', soft: '#eee', edge: '#aaa', frame: '#111', frameInk: '#fff', ink: '#111', muted: '#555', action: '#09f', actionInk: '#fff', hero: '#ddd', heroInk: '#111', link: '#078' }, homeTeam: { abbrev: 'EDM' } }) }));
jest.mock('../../../components/arena/ArenaPrimitives', () => {
  const { Pressable, Text } = require('react-native');
  return {
    arenaType: { body: 'Arial', display: 'Arial' },
    ArenaHeader: () => null,
    ArenaNote: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>,
    ArenaButton: ({ label, onPress }: { label: string; onPress: () => void }) => <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}><Text>{label}</Text></Pressable>,
  };
});
jest.mock('../../../components/arena/GamePoster', () => ({ GamePoster: () => null, gameTime: () => '7:00 PM' }));
jest.mock('../../../components/arena/GamePreview', () => ({ GamePreview: () => null }));
jest.mock('../../../components/arena/SeasonHub', () => ({ SeasonIdentity: () => null, SeasonClubhouse: () => null, SeasonGuide: () => null }));
jest.mock('../../../components/arena/PlayoffSeries', () => ({ PlayoffSeries: () => null }));
jest.mock('../../../hooks/useArenaGames', () => ({ useArenaGames: () => ({ games: [], loading: false, error: null, notice: null, refresh: jest.fn() }) }));
jest.mock('../../../utils/seasonContext', () => ({ resolveSeasonContext: () => ({ phase: 'regular', season: 20262027, label: 'Season', note: '', confidence: 'feed', nextGame: null }) }));

const fetchArenaStandings = jest.fn();
const fetchArenaResults = jest.fn();
jest.mock('../../../services/arenaData', () => ({
  fetchArenaStandings: (...args: unknown[]) => fetchArenaStandings(...args),
  fetchArenaResults: (...args: unknown[]) => fetchArenaResults(...args),
  fetchArenaGameById: jest.fn(), applyGameFreshness: (game: unknown) => game,
  isFinalGame: (game: { game_state: string }) => ['FINAL', 'OFF'].includes(game.game_state),
  isLiveGame: () => false, orderArenaGames: (games: unknown[]) => games,
  sourceFreshness: () => ({ status: 'fresh' }),
}));

const entry = { savedAt: '2026-10-01T18:00:00Z', game: { id: 7, season: 20262027, game_date: '2026-10-01', start_time_utc: '2026-10-01T23:00:00Z', game_type: 2, game_state: 'FUT', home_team_abbrev: 'EDM', away_team_abbrev: 'CGY', home_score: 0, away_score: 0, venue: null, updated_at: null, forecast: null } };
const getSeasonBook = jest.fn();
const removeFromSeasonBook = jest.fn();
let bookListener: (() => void) | undefined;
jest.mock('../../../services/seasonBook', () => ({
  getSeasonBook: (...args: unknown[]) => getSeasonBook(...args),
  removeFromSeasonBook: (...args: unknown[]) => removeFromSeasonBook(...args),
  saveToSeasonBook: jest.fn(), subscribeSeasonBook: (listener: () => void) => { bookListener = listener; return () => undefined; },
}));

const TeamDetailScreen = require('../teams').default as React.ComponentType;
const TonightScreen = require('../../../components/arena/TonightScreen').default as React.ComponentType;

beforeEach(() => {
  jest.clearAllMocks();
  routeParams = {};
  router.canGoBack.mockReturnValue(true);
  fetchArenaStandings.mockResolvedValue([]);
  fetchArenaResults.mockResolvedValue([]);
  getSeasonBook.mockResolvedValue([entry]);
  bookListener = undefined;
  global.requestAnimationFrame = ((callback: FrameRequestCallback) => { callback(0); return 1; }) as typeof requestAnimationFrame;
  global.cancelAnimationFrame = jest.fn();
});

test('declared team origin replaces to that tab even when unrelated history exists', async () => {
  routeParams = { team: 'EDM', from: 'following' };
  const screen = render(<TeamDetailScreen />);
  fireEvent.press(screen.getByLabelText('Back to Following'));
  expect(router.back).not.toHaveBeenCalled();
  expect(router.replace).toHaveBeenCalledWith('/(tabs)/following');
});

test('team link without a declared origin uses warm history and cold League fallback', () => {
  routeParams = { team: 'EDM' };
  const warm = render(<TeamDetailScreen />);
  fireEvent.press(warm.getByLabelText('Back to League'));
  expect(router.back).toHaveBeenCalledTimes(1);
  expect(router.replace).not.toHaveBeenCalled();
  warm.unmount();

  jest.clearAllMocks();
  router.canGoBack.mockReturnValue(false);
  const cold = render(<TeamDetailScreen />);
  fireEvent.press(cold.getByLabelText('Back to League'));
  expect(router.back).not.toHaveBeenCalled();
  expect(router.replace).toHaveBeenCalledWith('/(tabs)/stats');
});

test('failed confirmed Book removal keeps the card and exposes recovery', async () => {
  removeFromSeasonBook.mockRejectedValueOnce(new Error('disk full'));
  const screen = render(<TonightScreen />);
  await waitFor(() => expect(getSeasonBook).toHaveBeenCalled());
  fireEvent.press(screen.getByText('Season book'));
  await waitFor(() => expect(screen.getByLabelText('Remove CGY at EDM from season book')).toBeTruthy());
  fireEvent.press(screen.getByLabelText('Remove CGY at EDM from season book'));
  const buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)[2];
  await act(async () => { buttons[1].onPress(); await Promise.resolve(); });
  expect(screen.getByText('CGY AT EDM')).toBeTruthy();
  await waitFor(() => expect(Alert.alert).toHaveBeenLastCalledWith('Card could not be removed', 'Please try again.'));
});

test('successful saved-result retry clears the rendered stale error', async () => {
  fetchArenaResults.mockRejectedValueOnce(new Error('Saved results are offline')).mockResolvedValueOnce([]);
  const screen = render(<TonightScreen />);
  await waitFor(() => expect(screen.getByText('Saved results are offline')).toBeTruthy());
  await act(async () => { bookListener?.(); await Promise.resolve(); await Promise.resolve(); });
  await waitFor(() => expect(screen.queryByText('Saved results are offline')).toBeNull());
});
