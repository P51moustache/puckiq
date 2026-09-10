import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { fetchArenaGames } from "../services/arenaData";
import type { ArenaGame } from "../types/arena";

export function useArenaGames(homeTeam?: string | null) {
  const [games, setGames] = useState<ArenaGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const request = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++request.current;
    setLoading(true);
    try {
      const next = await fetchArenaGames(homeTeam);
      if (id !== request.current) return;
      setGames(next.games);
      setNotice(next.notice);
      setError(null);
    } catch (err) {
      if (id === request.current)
        setError(
          err instanceof Error
            ? err.message
            : "The schedule could not be refreshed.",
        );
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [homeTeam]);
  useEffect(() => {
    void refresh();
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    const timer = setInterval(() => {
      if (AppState.currentState === "active") void refresh();
    }, 60_000);
    // This is a request sequence, not a rendered node; invalidate any pending response.
    const sequence = request;
    return () => {
      sequence.current++;
      listener.remove();
      clearInterval(timer);
    };
  }, [refresh]);
  return { games, loading, error, notice, refresh };
}
