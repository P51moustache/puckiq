export type PlayerSearchOutcome<T> =
  | { kind: 'success'; results: T[] }
  | { kind: 'error' }
  | { kind: 'stale' };

export class PlayerSearchSession<T> {
  private generation = 0;
  constructor(private readonly fetchResults: (query: string) => Promise<T[]>) {}

  cancel(): void { this.generation += 1; }

  async search(query: string): Promise<PlayerSearchOutcome<T>> {
    const generation = ++this.generation;
    try {
      const results = await this.fetchResults(query);
      return generation === this.generation ? { kind: 'success', results } : { kind: 'stale' };
    } catch {
      return generation === this.generation ? { kind: 'error' } : { kind: 'stale' };
    }
  }
}
