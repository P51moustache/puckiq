import { useCallback, useEffect, useState } from 'react';
import {
  addWatchedPlayer,
  readWatchlist,
  removeWatchedPlayer,
  subscribeToWatchlist,
  toggleWatchedPlayer,
  type WatchedPlayer,
} from '../services/watchlist';

export function useWatchlist() {
  const [players, setPlayers] = useState<WatchedPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setPlayers(await readWatchlist()); }
    catch { setError('Watched players could not be loaded. Your stored list was preserved.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToWatchlist(setPlayers);
    void refresh();
    return unsubscribe;
  }, [refresh]);

  const toggle = useCallback(async (player: WatchedPlayer) => toggleWatchedPlayer(player), []);
  const add = useCallback(async (player: WatchedPlayer) => addWatchedPlayer(player), []);
  const remove = useCallback(async (playerId: number) => removeWatchedPlayer(playerId), []);

  return { players, loading, error, refresh, toggle, add, remove, isWatched: (id: number) => players.some(player => player.playerId === id) };
}
