import AsyncStorage from '@react-native-async-storage/async-storage';
const IDS_KEY = 'puckiq_watchlist';
const METADATA_KEY = 'puckiq_watchlist_metadata_v1';
export interface WatchedPlayer { playerId: number; fullName: string; teamAbbrev: string; position: string; headshotUrl?: string }
type Listener = (players: WatchedPlayer[]) => void;
const listeners = new Set<Listener>();
let pending: Promise<unknown> = Promise.resolve();
function validIds(value: unknown): number[] {
  if (!Array.isArray(value)) throw new Error('Watched players could not be read. Stored data has been preserved.');
  return [...new Set(value.filter((id): id is number => Number.isInteger(id) && id > 0))];
}
function validMetadata(value: unknown): WatchedPlayer[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is WatchedPlayer => !!item && Number.isInteger((item as any).playerId) && typeof (item as any).fullName === 'string');
}
function parseMetadata(raw: string | null): WatchedPlayer[] {
  if (!raw) return [];
  try { return validMetadata(JSON.parse(raw)); } catch { return []; }
}
async function readRaw(): Promise<WatchedPlayer[]> {
  const [idsRaw, metadataRaw] = await Promise.all([AsyncStorage.getItem(IDS_KEY), AsyncStorage.getItem(METADATA_KEY)]);
  const parsedIds: unknown = idsRaw ? JSON.parse(idsRaw) : [];
  const embedded = validMetadata(parsedIds);
  const ids = embedded.length ? embedded.map(item => item.playerId) : validIds(parsedIds);
  const metadata = [...parseMetadata(metadataRaw), ...embedded];
  const byId = new Map(metadata.map(player => [player.playerId, player]));
  return ids.map(playerId => byId.get(playerId) ?? { playerId, fullName: `Player #${playerId}`, teamAbbrev: '', position: '' });
}
function publish(players: WatchedPlayer[]) {
  const copy = players.map(player => ({ ...player }));
  listeners.forEach(listener => { try { listener(copy); } catch (error) { console.error('Error notifying watchlist subscriber:', error); } });
}
async function persist(players: WatchedPlayer[]) {
  await AsyncStorage.multiSet([[IDS_KEY, JSON.stringify(players.map(player => player.playerId))], [METADATA_KEY, JSON.stringify(players)]]);
  publish(players);
}
export function readWatchlist(): Promise<WatchedPlayer[]> {
  const next = pending.catch(() => undefined).then(() => readRaw());
  pending = next;
  return next;
}
export function subscribeToWatchlist(listener: Listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function mutate<T>(operation: (players: WatchedPlayer[]) => Promise<T>): Promise<T> {
  const next = pending.catch(() => undefined).then(() => readRaw()).then(operation);
  pending = next;
  return next;
}
export function addWatchedPlayer(player: WatchedPlayer) { return mutate(async players => persist([...players.filter(item => item.playerId !== player.playerId), { ...player }])); }
export function removeWatchedPlayer(playerId: number): Promise<WatchedPlayer | null> { return mutate(async players => { const removed = players.find(player => player.playerId === playerId) ?? null; if (removed) await persist(players.filter(player => player.playerId !== playerId)); return removed; }); }
export function toggleWatchedPlayer(player: WatchedPlayer): Promise<boolean> { return mutate(async players => { const watched = players.some(item => item.playerId === player.playerId); await persist(watched ? players.filter(item => item.playerId !== player.playerId) : [...players, { ...player }]); return !watched; }); }
