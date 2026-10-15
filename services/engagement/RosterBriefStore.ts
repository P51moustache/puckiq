import { parseRosterSnapshot, type RosterSnapshot } from './rosterBrief';

export interface BriefStorage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }

/** Small local cache bridges rapid blur/re-focus without racing an older disk read. */
export class RosterBriefStore {
  private readonly cache = new Map<string, RosterSnapshot>();
  private writes: Promise<void> = Promise.resolve();
  constructor(private readonly storage: BriefStorage, private readonly now: () => number) {}

  async load(teamId: string): Promise<RosterSnapshot | null> {
    if (this.cache.has(teamId)) return this.cache.get(teamId)!;
    try {
      const snapshot = parseRosterSnapshot(await this.storage.getItem(this.key(teamId)), this.now());
      return this.cache.get(teamId) ?? snapshot;
    } catch { return null; }
  }

  save(teamId: string, snapshot: RosterSnapshot): Promise<void> {
    this.cache.set(teamId, snapshot);
    this.writes = this.writes.catch(() => undefined).then(() => this.storage.setItem(this.key(teamId), JSON.stringify(snapshot)));
    return this.writes;
  }

  private key(teamId: string) { return `puckiq_roster_brief_v1_${teamId}`; }
}
