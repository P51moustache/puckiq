import type { HostLink } from '../fantasy/hostLinks';
import type { UsageEmitter } from './usageJourney';

/** Logs tap and OS link result, never the private team URL or a claimed host roster change. */
export async function openHostLink(
  host: HostLink,
  source: string,
  openUrl: (url: string) => Promise<unknown>,
  emit: UsageEmitter,
): Promise<void> {
  const properties = { host: host.name.toLowerCase(), team_page: host.teamPage, source };
  emit('host_open', properties);
  try {
    await openUrl(host.url);
    emit('host_open_result', { ...properties, result: 'opened' });
  } catch {
    emit('host_open_result', { ...properties, result: 'failed' });
  }
}
