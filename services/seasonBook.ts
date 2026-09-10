import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ArenaGame, SeasonEntry } from "../types/arena";

const KEY = "puckiq_season_book_v1";
const listeners = new Set<() => void>();
let pending: Promise<unknown> = Promise.resolve();
export const subscribeSeasonBook = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

function validForecast(value: unknown): boolean {
  if (value === null) return true;
  if (!value || typeof value !== "object") return false;
  const forecast = value as Record<string, unknown>;
  return (
    typeof forecast.homeProbability === "number" &&
    Number.isFinite(forecast.homeProbability) &&
    forecast.homeProbability >= 0 &&
    forecast.homeProbability <= 1 &&
    typeof forecast.model === "string" &&
    !!forecast.model &&
    typeof forecast.version === "string" &&
    !!forecast.version &&
    typeof forecast.predictedAt === "string" &&
    Number.isFinite(Date.parse(forecast.predictedAt))
  );
}

export async function getSeasonBook(): Promise<SeasonEntry[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  const entries: unknown = JSON.parse(raw);
  if (
    !Array.isArray(entries) ||
    !entries.every(
      (entry) =>
        entry &&
        typeof entry.savedAt === "string" &&
        Number.isFinite(Date.parse(entry.savedAt)) &&
        entry.game &&
        Number.isInteger(entry.game.id) &&
        typeof entry.game.home_team_abbrev === "string" &&
        typeof entry.game.away_team_abbrev === "string" &&
        Number.isFinite(Date.parse(entry.game.start_time_utc)) &&
        validForecast(entry.game.forecast),
    )
  )
    throw new Error(
      "Your season book could not be read. The stored cards have been preserved.",
    );
  return entries as SeasonEntry[];
}

function mutate(
  update: (entries: SeasonEntry[]) => SeasonEntry[],
): Promise<void> {
  const operation = pending
    .catch(() => undefined)
    .then(async () => {
      const entries = update(await getSeasonBook());
      await AsyncStorage.setItem(KEY, JSON.stringify(entries));
      listeners.forEach((listener) => listener());
    });
  pending = operation;
  return operation;
}

export function saveToSeasonBook(game: ArenaGame): Promise<void> {
  // Clone at the tap, before the queued write. Later feed changes cannot alter the snapshot.
  const entry: SeasonEntry = JSON.parse(
    JSON.stringify({ game, savedAt: new Date().toISOString() }),
  );
  return mutate((entries) =>
    entries.some((saved) => saved.game.id === game.id)
      ? entries
      : [entry, ...entries],
  );
}

export const removeFromSeasonBook = (id: number) =>
  mutate((entries) => entries.filter((entry) => entry.game.id !== id));
