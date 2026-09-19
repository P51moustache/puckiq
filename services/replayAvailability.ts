import { runBacktest } from './backtesting';
import { createDefaultModel } from './modelStorage';

export interface ReplayDateRange {
  start: string;
  end: string;
}

export interface ReplayAvailability {
  available: boolean;
  gameCount: number;
  latestGameDate: string | null;
  range: ReplayDateRange;
}

/** Read-only availability for the exact period a local four-factor replay will use. */
export async function checkReplayAvailability(range: ReplayDateRange): Promise<ReplayAvailability> {
  try {
    const result = await runBacktest(createDefaultModel(), range, undefined, true);
    const latestGameDate = result.results.reduce<string | null>(
      (latest, game) => latest === null || game.date > latest ? game.date : latest,
      null,
    );
    return {
      available: result.totalGames > 0,
      gameCount: result.totalGames,
      latestGameDate,
      range,
    };
  } catch {
    throw new Error('Unable to check replay data availability');
  }
}
