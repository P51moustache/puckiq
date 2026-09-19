import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getSeasonBook,
  saveToSeasonBook,
  removeFromSeasonBook,
} from "../seasonBook";
import type { ArenaGame } from "../../types/arena";
import { formatFinalScore } from "../../utils/arenaSlate";

const game = (id: number): ArenaGame => ({
  id,
  season: 20262027,
  game_date: "2026-10-01",
  start_time_utc: "2026-10-01T23:00:00Z",
  game_type: 2,
  game_state: "FUT",
  home_team_abbrev: "BOS",
  away_team_abbrev: "TOR",
  home_score: 0,
  away_score: 0,
  venue: null,
  updated_at: null,
  forecast: null,
});
let stored: string | null;
beforeEach(() => {
  stored = null;
  (AsyncStorage.getItem as jest.Mock).mockImplementation(async () => stored);
  (AsyncStorage.setItem as jest.Mock).mockImplementation(
    async (_key, value) => {
      stored = value;
    },
  );
});
it("serializes concurrent saves and keeps the original snapshot on repeat saves", async () => {
  await Promise.all([saveToSeasonBook(game(1)), saveToSeasonBook(game(2))]);
  await saveToSeasonBook({ ...game(1), home_score: 5 });
  const book = await getSeasonBook();
  expect(book).toHaveLength(2);
  expect(book.find((entry) => entry.game.id === 1)?.game.home_score).toBe(0);
  await removeFromSeasonBook(1);
  expect((await getSeasonBook()).map((entry) => entry.game.id)).toEqual([2]);
});
it("preserves corrupt storage and reports it instead of overwriting it", async () => {
  stored = "{bad";
  await expect(saveToSeasonBook(game(3))).rejects.toThrow();
  expect(stored).toBe("{bad");
});
it("reports failed writes and allows a later retry", async () => {
  (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
    new Error("disk full"),
  );
  await expect(saveToSeasonBook(game(1))).rejects.toThrow("disk full");
  expect(await getSeasonBook()).toEqual([]);
  await saveToSeasonBook(game(1));
  expect(await getSeasonBook()).toHaveLength(1);
});
it("preserves cards with malformed forecast data instead of displaying fabricated percentages", async () => {
  stored = JSON.stringify([
    {
      game: { ...game(1), forecast: { homeProbability: 63 } },
      savedAt: "2026-10-01T18:00:00Z",
    },
  ]);
  const before = stored;
  await expect(getSeasonBook()).rejects.toThrow("preserved");
  await expect(saveToSeasonBook(game(2))).rejects.toThrow("preserved");
  expect(stored).toBe(before);
});
it("formats final score only when both scores are valid and keeps zero valid", () => {
  expect(formatFinalScore({ ...game(1), game_state: "OFF", away_score: 0, home_score: 3 })).toBe("0–3");
  expect(formatFinalScore({ ...game(1), game_state: "OFF", away_score: null, home_score: 3 })).toBe("SCORE UNAVAILABLE");
  expect(formatFinalScore({ ...game(1), game_state: "OFF", away_score: Number.NaN, home_score: 3 })).toBe("SCORE UNAVAILABLE");
});
