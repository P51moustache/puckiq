import {
  normalizeArenaForecast,
  orderArenaGames,
  forecastChange,
  arenaGameHeadline,
  nhlDate,
  fetchArenaGames,
} from "../arenaData";
import { supabase } from "../../lib/supabase";
import type { ArenaGame } from "../../types/arena";

const forecast = {
  home_win_prob: 0.63,
  away_win_prob: 0.37,
  model_type: "game_winner",
  model_version: "v1",
  predicted_at: "2026-09-10T10:00:00Z",
};
describe("Arena game data", () => {
  it("distinguishes tonight, future, live, final, and offseason cards in NHL time", () => {
    const now = new Date("2026-10-02T03:30:00Z");
    expect(nhlDate(now)).toBe("2026-10-01");
    const game = { game_date: "2026-10-01", game_state: "FUT" } as ArenaGame;
    expect(arenaGameHeadline(game, now)).toBe("GAME\nNIGHT");
    expect(arenaGameHeadline({ ...game, game_date: "2026-10-02" }, now)).toBe(
      "NEXT\nGAME",
    );
    expect(
      arenaGameHeadline(
        { ...game, game_date: "2026-09-30", game_state: "LIVE" },
        now,
      ),
    ).toBe("GAME\nNIGHT");
    expect(arenaGameHeadline({ ...game, game_state: "OFF" }, now)).toBe(
      "FINAL\nBUZZER",
    );
    expect(arenaGameHeadline(null, now)).toBe("SEASON\nAHEAD");
  });

  it("includes the home team next game even beyond the first 64 league games", async () => {
    const rows = Array.from({ length: 64 }, (_, index) => ({ id: index + 1 }));
    const nextHome = {
      id: 200,
      home_team_abbrev: "EDM",
      away_team_abbrev: "VAN",
    };
    const builder = (data: unknown[]) => {
      const query: Record<string, unknown> = {
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data, error: null }).then(resolve),
      };
      for (const method of [
        "select",
        "gte",
        "or",
        "order",
        "limit",
        "in",
        "eq",
      ])
        query[method] = jest.fn(() => query);
      return query;
    };
    const homeQuery = builder([nextHome]);
    const from = jest.spyOn(supabase, "from");
    from
      .mockReturnValueOnce(builder(rows) as never)
      .mockReturnValueOnce(homeQuery as never)
      .mockReturnValueOnce(builder([]) as never);
    const result = await fetchArenaGames("EDM");
    expect(result.games).toHaveLength(65);
    expect(result.games.find((game) => game.id === 200)).toMatchObject(
      nextHome,
    );
    expect(homeQuery.or).toHaveBeenCalledWith(
      "home_team_abbrev.eq.EDM,away_team_abbrev.eq.EDM",
    );
    from.mockRestore();
  });
  it("accepts only a complete probability pair from a timestamped model", () => {
    expect(normalizeArenaForecast(forecast)?.homeProbability).toBe(0.63);
    for (const value of [null, NaN, 63, -1, 1.01]) {
      expect(
        normalizeArenaForecast({ ...forecast, home_win_prob: value }),
      ).toBeNull();
    }
    expect(
      normalizeArenaForecast({ ...forecast, away_win_prob: 0.5 }),
    ).toBeNull();
    expect(
      normalizeArenaForecast({ ...forecast, predicted_at: "bad" }),
    ).toBeNull();
    expect(normalizeArenaForecast(null)).toBeNull();
  });
  it("prioritizes the home team without mutating the schedule", () => {
    const games = [
      {
        id: 1,
        home_team_abbrev: "BOS",
        away_team_abbrev: "TOR",
        start_time_utc: "2026-10-01T22:00:00Z",
      },
      {
        id: 2,
        home_team_abbrev: "EDM",
        away_team_abbrev: "DAL",
        start_time_utc: "2026-10-02T02:00:00Z",
      },
    ] as ArenaGame[];
    expect(orderArenaGames(games, "EDM").map((g) => g.id)).toEqual([2, 1]);
    expect(games[0].id).toBe(1);
  });
  it("compares the same model and version only", () => {
    const saved = normalizeArenaForecast(forecast)!;
    expect(
      forecastChange(saved, { ...saved, homeProbability: 0.68 }),
    ).toBeCloseTo(5);
    expect(forecastChange(saved, { ...saved, version: "v2" })).toBeNull();
    expect(forecastChange(null, saved)).toBeNull();
  });
});
