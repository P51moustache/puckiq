import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import {
  ArenaPalette,
  ArenaTeam,
  getArenaPalette,
  getArenaTeam,
} from "../../constants/arenaTheme";
import { getStoredHomeTeam, setStoredHomeTeam } from "../../services/homeTeam";
import {
  addFavoriteTeam,
  FavoriteTeam,
  readFavoriteTeams as getFavoriteTeams,
  removeFavoriteTeam,
  subscribeToFavoriteTeams,
} from "../../services/teamFavorites";

export interface ArenaContextValue {
  palette: ArenaPalette;
  homeTeam: ArenaTeam | null;
  followedTeams: FavoriteTeam[];
  loading: boolean;
  chooseHomeTeam(abbrev: string): Promise<void>;
  followTeam(abbrev: string): Promise<void>;
  unfollowTeam(abbrev: string): Promise<void>;
  refreshTeams(): Promise<void>;
}

const noop = async () => {};

const DEFAULT_ARENA_CONTEXT: ArenaContextValue = {
  palette: getArenaPalette(),
  homeTeam: null,
  followedTeams: [],
  loading: false,
  chooseHomeTeam: noop,
  followTeam: noop,
  unfollowTeam: noop,
  refreshTeams: noop,
};

const ArenaContext = createContext<ArenaContextValue>(DEFAULT_ARENA_CONTEXT);

function followedActiveTeam(
  favorites: FavoriteTeam[],
  abbrev: string | null,
): ArenaTeam | null {
  if (!abbrev) {
    return null;
  }

  const team = getArenaTeam(abbrev);
  if (!team) {
    return null;
  }

  return favorites.some(
    (favorite) => getArenaTeam(favorite.triCode)?.abbrev === team.abbrev,
  )
    ? team
    : null;
}

function earliestActiveTeam(favorites: FavoriteTeam[]): ArenaTeam | null {
  let selected: { team: ArenaTeam; timestamp: number } | null = null;

  for (const favorite of favorites) {
    const team = getArenaTeam(favorite.triCode);
    if (!team) {
      continue;
    }

    const parsed = Date.parse(favorite.addedAt);
    const timestamp = Number.isFinite(parsed)
      ? parsed
      : Number.POSITIVE_INFINITY;
    if (!selected || timestamp < selected.timestamp) {
      selected = { team, timestamp };
    }
  }

  return selected?.team ?? null;
}

export function ArenaProvider({ children }: { children: React.ReactNode }) {
  const [homeTeam, setHomeTeam] = useState<ArenaTeam | null>(null);
  const [followedTeams, setFollowedTeams] = useState<FavoriteTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(false);
  const requestVersionRef = useRef(0);
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());

  const loadAndPublish = useCallback(async (requestVersion: number) => {
    const [favorites, storedHome] = await Promise.all([
      getFavoriteTeams(),
      getStoredHomeTeam(),
    ]);
    if (!mountedRef.current || requestVersion !== requestVersionRef.current) {
      return;
    }

    const selected =
      followedActiveTeam(favorites, storedHome) ??
      earliestActiveTeam(favorites);
    const selectedAbbrev = selected?.abbrev ?? null;
    if (selectedAbbrev !== storedHome) {
      await setStoredHomeTeam(selectedAbbrev);
      if (!mountedRef.current || requestVersion !== requestVersionRef.current) {
        return;
      }
    }

    setFollowedTeams(favorites);
    setHomeTeam(selected);
    setLoading(false);
  }, []);

  const refreshTeams = useCallback(async () => {
    const run = mutationQueueRef.current
      .catch(() => {})
      .then(async () => {
        const requestVersion = ++requestVersionRef.current;
        await loadAndPublish(requestVersion);
      });
    mutationQueueRef.current = run;
    return run;
  }, [loadAndPublish]);

  const enqueueMutation = useCallback(
    (operation: () => Promise<void>): Promise<void> => {
      const run = mutationQueueRef.current
        .catch(() => {})
        .then(async () => {
          const requestVersion = ++requestVersionRef.current;
          await operation();
          await loadAndPublish(requestVersion);
        });
      mutationQueueRef.current = run;
      return run;
    },
    [loadAndPublish],
  );

  const chooseHomeTeam = useCallback(
    (abbrev: string) =>
      enqueueMutation(async () => {
        const team = getArenaTeam(abbrev);
        const favorites = await getFavoriteTeams();
        if (!team || !followedActiveTeam(favorites, team.abbrev)) {
          throw new Error("Home team must be followed and active");
        }
        await setStoredHomeTeam(team.abbrev);
      }),
    [enqueueMutation],
  );

  const followTeam = useCallback(
    (abbrev: string) =>
      enqueueMutation(async () => {
        const team = getArenaTeam(abbrev);
        if (!team) {
          throw new Error(`Unknown active NHL team: ${abbrev}`);
        }

        await addFavoriteTeam(team.abbrev, team.name);
        // loadAndPublish re-reads the service after its serialized write, then picks
        // the earliest favorite only when there is no valid persisted home team.
      }),
    [enqueueMutation],
  );

  const unfollowTeam = useCallback(
    (abbrev: string) =>
      enqueueMutation(async () => {
        const favorites = await getFavoriteTeams();
        const favorite = favorites.find(
          (candidate) =>
            candidate.triCode.toUpperCase() === abbrev.toUpperCase(),
        );
        if (!favorite) {
          return;
        }

        const storedHome = await getStoredHomeTeam();
        const remaining = favorites.filter(
          (candidate) => candidate !== favorite,
        );
        await removeFavoriteTeam(favorite.triCode);

        if (!followedActiveTeam(remaining, storedHome)) {
          await setStoredHomeTeam(
            earliestActiveTeam(remaining)?.abbrev ?? null,
          );
        }
      }),
    [enqueueMutation],
  );

  useEffect(() => {
    mountedRef.current = true;
    const unsubscribe = subscribeToFavoriteTeams(() => {
      // Queue behind any active operation, including partially failed mutations.
      void refreshTeams().catch(() => {});
    });
    const appStateSubscription = AppState?.addEventListener?.(
      "change",
      (state) => {
        if (state === "active") {
          void refreshTeams().catch(() => {});
        }
      },
    );
    void refreshTeams().catch(() => {
      if (mountedRef.current) {
        setLoading(false);
      }
    });

    return () => {
      mountedRef.current = false;
      requestVersionRef.current += 1;
      unsubscribe();
      appStateSubscription?.remove();
    };
  }, [refreshTeams]);

  const value = useMemo<ArenaContextValue>(
    () => ({
      palette: getArenaPalette(homeTeam?.abbrev),
      homeTeam,
      followedTeams,
      loading,
      chooseHomeTeam,
      followTeam,
      unfollowTeam,
      refreshTeams,
    }),
    [
      homeTeam,
      followedTeams,
      loading,
      chooseHomeTeam,
      followTeam,
      unfollowTeam,
      refreshTeams,
    ],
  );

  return (
    <ArenaContext.Provider value={value}>{children}</ArenaContext.Provider>
  );
}

export function useArena(): ArenaContextValue {
  return useContext(ArenaContext);
}
