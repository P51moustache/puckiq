import type { UsageEmitter, UsageProperties } from './usageJourney';

/** One visit per opening. Store retries and re-renders are not new paywall impressions. */
export class PaywallJourney {
  private visit: { id: string; source: string; startedAt: number } | null = null;

  constructor(
    private readonly emit: UsageEmitter,
    private readonly now: () => number,
    private readonly newId: () => string,
  ) {}

  open(source: string): void {
    this.close('source_changed');
    this.visit = { id: this.newId(), source, startedAt: this.now() };
    this.record('paywall_view');
  }

  record(event: string, properties: UsageProperties = {}): void {
    if (!this.visit) return;
    this.emit(event, {
      ...properties,
      source: this.visit.source,
      paywall_visit_id: this.visit.id,
      elapsed_ms: Math.max(0, this.now() - this.visit.startedAt),
    });
  }

  close(reason: string): void {
    if (!this.visit) return;
    this.record('paywall_dismiss', { reason });
    this.visit = null;
  }
}
