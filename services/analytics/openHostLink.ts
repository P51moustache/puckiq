import type { HostLink } from '../fantasy/hostLinks';
import type { WebLinkResult } from '../native/safeOpen';
import type { UsageEmitter } from './usageJourney';

/** Where the tap landed: the host's app or Safari ('opened'), the in-app browser, or an alert with the URL. */
export type HostOpenResult = WebLinkResult | 'failed';

/**
 * Logs the tap and where it landed, never the private team URL or a claimed host roster change.
 * `open` is expected to fall back on its own (safeOpen.openWebLink); 'failed' only covers it throwing.
 */
export async function openHostLink(
  host: HostLink,
  source: string,
  open: (url: string) => Promise<WebLinkResult>,
  emit: UsageEmitter,
): Promise<HostOpenResult> {
  const properties = { host: host.name.toLowerCase(), team_page: host.teamPage, source };
  emit('host_open', properties);
  let result: HostOpenResult;
  try {
    result = await open(host.url);
  } catch {
    result = 'failed';
  }
  emit('host_open_result', { ...properties, result });
  return result;
}
