/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PlayersScreen from '../players';
import FollowingScreen from '../following';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockStorage = new Map<string, string>();
const mockSearchActivePlayers = jest.fn(async (query: string, _limit?: number) => query === 'co' ? [{ playerId:7, firstName:'Cole', lastName:'Caufield', fullName:'Cole Caufield', position:'RW', teamAbbrev:'MTL' }] : []);
jest.mock('react-native', () => ({ View:'View', Text:'Text', TextInput:'TextInput', TouchableOpacity:'TouchableOpacity', Pressable:'Pressable', ScrollView:'ScrollView', FlatList:({data,renderItem,ListEmptyComponent,...props}:any) => <>{data.length ? data.map((item:any,index:number)=>renderItem({item,index})) : ListEmptyComponent}</>, ActivityIndicator:'ActivityIndicator', Modal:'Modal', RefreshControl:'RefreshControl', StyleSheet:{create:(styles:any)=>styles}, Platform:{OS:'ios',select:(values:any)=>values.ios}, Alert:{alert:jest.fn()} }));
jest.mock('@expo/vector-icons', () => ({ Ionicons:'Ionicons' }));
jest.mock('expo-image', () => ({ Image:'Image' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient:'LinearGradient' }));
jest.mock('../../../components/ui/IconSymbol', () => ({ IconSymbol:'IconSymbol' }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
    multiSet: jest.fn(async (pairs: [string, string][]) => pairs.forEach(([key, value]) => mockStorage.set(key, value))),
    multiRemove: jest.fn(async (keys: string[]) => keys.forEach(key => mockStorage.delete(key))),
  },
}));

jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useFocusEffect: (fn: any) => require('react').useEffect(fn, []), useLocalSearchParams: () => ({}) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View, useSafeAreaInsets: () => ({ top: 0 }) }));
jest.mock('../../../components/arena/ArenaProvider', () => ({ useArena: () => ({ palette: { page:'#fff',paper:'#fff',soft:'#eee',edge:'#ccc',ink:'#111',muted:'#555',link:'#067',focus:'#067',action:'#0cf',actionInk:'#111',hero:'#123',heroInk:'#fff',frame:'#123',frameInk:'#fff' }, homeTeam:null, followedTeams:[], loading:false, followTeam:jest.fn(), unfollowTeam:jest.fn(), chooseHomeTeam:jest.fn() }) }));
jest.mock('../../../hooks/useAnalytics', () => ({ useAnalytics: () => ({ trackCustomEvent: jest.fn() }) }));
jest.mock('../../../services/playerSearch', () => ({ searchActivePlayers: (query:string, limit?:number) => mockSearchActivePlayers(query, limit) }));
jest.mock('../../../services/playerTrends', () => ({ getLeagueLeadersStrict:jest.fn(async()=>[]), getTrendingPlayersStrict:jest.fn(async()=>[]), getTrendingGoalies:jest.fn(async()=>[]), getPlayersPlayingTonightStrict:jest.fn(async()=>[]), getPlayerProjections:jest.fn(async()=>[]), getLeaderTrends:jest.fn(async()=>new Map()), batchGetHitRates:jest.fn(async()=>new Map()), clearTrendsCache:jest.fn() }));
jest.mock('../../../services/fantasyProjections', () => ({ getWaiverWireRecommendations: jest.fn(async()=>[]) }));
jest.mock('../../../services/playerDetail', () => ({ getPlayerDetailStrict: jest.fn(async()=>({ bio:{playerId:7,fullName:'Cole Caufield',firstName:'Cole',lastName:'Caufield',teamAbbrev:'MTL',position:'RW'}, seasonStats:null,recentGames:[],career:null,edgeStats:null,trends:null })), getPlayerDetail: jest.fn(async()=>null) }));
jest.mock('../../../components/arena/ArenaPrimitives', () => ({ ArenaHeader: ({title}:any) => <>{title}</>, ArenaNote: ({children}:any)=><>{children}</>, ArenaButton: ({label,onPress}:any) => { const { Pressable, Text } = require('react-native'); return <Pressable onPress={onPress}><Text>{label}</Text></Pressable>; }, arenaType:{body:undefined,display:undefined} }));
jest.mock('../../../components/ui/SkeletonLoader', () => ({ Skeleton: () => null }));
jest.mock('../../../components/ThemedView', () => ({ ThemedView: require('react-native').View }));
jest.mock('../../../components/PremiumGate', () => ({ children }:any) => children);
jest.mock('../../../components/CompactPlayerRow', () => () => null);
jest.mock('../../../components/ElevatedPlayerRow', () => () => null);
jest.mock('../../../components/FantasyProjectionRow', () => () => null);
jest.mock('../../../components/GoalieSpotlightCard', () => () => null);
jest.mock('../../../components/HeroLeaderCard', () => () => null);
jest.mock('../../../components/PlayerProjectionCard', () => () => null);

describe('player watch journey', () => {
  beforeEach(async () => { jest.useFakeTimers(); jest.clearAllMocks(); mockStorage.clear(); await AsyncStorage.multiRemove(['puckiq_watchlist','puckiq_watchlist_metadata_v1']); });
  afterEach(() => jest.useRealTimers());

  it('keeps one-character search mounted, watches detail, then removes and restores from Following', async () => {
    let players!: TestRenderer.ReactTestRenderer;
    await act(async () => { players = TestRenderer.create(<PlayersScreen />); await Promise.resolve(); });
    act(() => players.root.findByProps({ testID:'search-toggle' }).props.onPress());
    act(() => players.root.findByProps({ testID:'player-search-input-active' }).props.onChangeText('c'));
    expect(players.root.findByProps({ testID:'player-search-input-active' }).props.value).toBe('c');
    act(() => players.root.findByProps({ testID:'player-search-input-active' }).props.onChangeText('co'));
    await act(async () => { jest.advanceTimersByTime(301); await Promise.resolve(); });
    act(() => players.root.findByProps({ testID:'search-result-7' }).props.onPress());
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await players.root.findByProps({ testID:'player-detail-watch' }).props.onPress(); });
    expect(JSON.parse((await AsyncStorage.getItem('puckiq_watchlist'))!)).toEqual([7]);
    players.unmount();

    let following!: TestRenderer.ReactTestRenderer;
    await act(async () => { following = TestRenderer.create(<FollowingScreen />); await Promise.resolve(); await Promise.resolve(); });
    expect(following.root.findByProps({ accessibilityLabel:'Open Cole Caufield player detail' })).toBeTruthy();
    await act(async () => { await following.root.findByProps({ accessibilityLabel:'Unwatch Cole Caufield' }).props.onPress({stopPropagation:jest.fn()}); });
    const undo = following.root.findByProps({ accessibilityLabel:'Undo removing Cole Caufield' });
    await act(async () => { await undo.props.onPress(); });
    expect(following.root.findByProps({ accessibilityLabel:'Open Cole Caufield player detail' })).toBeTruthy();
  });

  it('keeps the query for Retry and exposes a failed watch write in rendered detail', async () => {
    mockSearchActivePlayers.mockRejectedValueOnce(new Error('offline'));
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => { tree = TestRenderer.create(<PlayersScreen />); await Promise.resolve(); });
    act(() => tree.root.findByProps({ testID:'search-toggle' }).props.onPress());
    act(() => tree.root.findByProps({ testID:'player-search-input-active' }).props.onChangeText('co'));
    await act(async () => { jest.advanceTimersByTime(301); await Promise.resolve(); });
    expect(tree.root.findByProps({ accessibilityLabel:'Retry search for co' })).toBeTruthy();
    expect(tree.root.findByProps({ testID:'player-search-input-active' }).props.value).toBe('co');
    mockSearchActivePlayers.mockResolvedValueOnce([{ playerId:7, firstName:'Cole', lastName:'Caufield', fullName:'Cole Caufield', position:'RW', teamAbbrev:'MTL' }]);
    act(() => tree.root.findByProps({ accessibilityLabel:'Retry search for co' }).props.onPress());
    await act(async () => { jest.advanceTimersByTime(301); await Promise.resolve(); });
    act(() => tree.root.findByProps({ testID:'search-result-7' }).props.onPress());
    await act(async () => { await Promise.resolve(); });
    (AsyncStorage.multiSet as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
    await act(async () => { await tree.root.findByProps({ testID:'player-detail-watch' }).props.onPress(); });
    expect(tree.root.findByProps({ accessibilityLabel:'Retry updating watchlist for Cole Caufield' })).toBeTruthy();
  });
});
