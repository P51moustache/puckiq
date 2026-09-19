export interface ReplayRunToken { id: number; key: string }

export function createReplayRunGuard() {
  let generation = 0;
  let active: ReplayRunToken | null = null;
  return {
    begin(key: string): ReplayRunToken | null {
      if (active) return null;
      active = { id: ++generation, key };
      return active;
    },
    isCurrent(token: ReplayRunToken, key: string): boolean {
      return active?.id === token.id && token.key === key;
    },
    finish(token: ReplayRunToken): void {
      if (active?.id === token.id) active = null;
    },
    invalidate(): void {
      generation += 1;
      active = null;
    },
  };
}
