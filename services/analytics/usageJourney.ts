export type UsageProperties = Record<string, string | number | boolean>;
export type UsageEmitter = (event: string, properties: UsageProperties) => void;

/** Tracks foreground screen segments. Background time never counts as engagement. */
export class UsageJourney {
  private screen: string | null = null;
  private screenStartedAt: number | null = null;
  private foregroundStartedAt: number | null = null;

  constructor(private readonly now: () => number, private readonly emit: UsageEmitter) {}

  navigate(screen: string | null): void {
    if (this.screen === screen) return;
    this.finishScreen();
    this.screen = screen;
    if (this.foregroundStartedAt !== null) this.startScreen();
  }

  setActive(active: boolean): void {
    if (active === (this.foregroundStartedAt !== null)) return;
    if (active) {
      this.foregroundStartedAt = this.now();
      this.emit('app_foreground', {});
      this.startScreen();
    } else {
      this.finishScreen();
      this.emit('app_background', { foreground_ms: Math.max(0, this.now() - this.foregroundStartedAt!) });
      this.foregroundStartedAt = null;
    }
  }

  private startScreen(): void {
    if (this.screen === null) return;
    this.screenStartedAt = this.now();
    this.emit('screen_view', { screen_name: this.screen });
  }

  private finishScreen(): void {
    if (this.screen !== null && this.screenStartedAt !== null) {
      this.emit('screen_engagement', { screen_name: this.screen, active_ms: Math.max(0, this.now() - this.screenStartedAt) });
    }
    this.screenStartedAt = null;
  }
}
