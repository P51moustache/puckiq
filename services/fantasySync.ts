/**
 * League-import adapters. Yahoo OAuth / ESPN are stubbed on purpose for v1.
 * Manual roster is the supported path; keep this surface stable so sync can plug in next.
 */

import type { FantasyPlayer, FantasySyncAdapter } from '../types/fantasy';

export class FantasySyncNotReadyError extends Error {
  constructor(provider: string, detail: string) {
    super(`${provider}: ${detail}`);
    this.name = 'FantasySyncNotReadyError';
  }
}

const YAHOO_STUB_REASON =
  'Yahoo Fantasy OAuth is not in this build. Add players manually; sync plugs in here next.';

const ESPN_STUB_REASON =
  'ESPN league import is not in this build. Add players manually; sync plugs in here next.';

export const yahooFantasySync: FantasySyncAdapter = {
  id: 'yahoo',
  label: 'Yahoo Fantasy',
  available: false,
  reasonUnavailable: YAHOO_STUB_REASON,
  async connectAndImport(): Promise<FantasyPlayer[]> {
    throw new FantasySyncNotReadyError('Yahoo Fantasy', YAHOO_STUB_REASON);
  },
};

export const espnFantasySync: FantasySyncAdapter = {
  id: 'espn',
  label: 'ESPN Fantasy',
  available: false,
  reasonUnavailable: ESPN_STUB_REASON,
  async connectAndImport(): Promise<FantasyPlayer[]> {
    throw new FantasySyncNotReadyError('ESPN Fantasy', ESPN_STUB_REASON);
  },
};

export const FANTASY_SYNC_ADAPTERS: FantasySyncAdapter[] = [
  yahooFantasySync,
  espnFantasySync,
];

export function getFantasySyncAdapter(id: 'yahoo' | 'espn'): FantasySyncAdapter {
  return id === 'espn' ? espnFantasySync : yahooFantasySync;
}
