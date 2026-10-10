/**
 * "Open Yahoo": PuckIQ never writes lineups, so the move happens in the host app. This is where
 * that button goes — the team page the user pasted in League settings, or the platform's fantasy
 * hockey home. On iOS these https links open the host's app when it's installed.
 */

import type { FantasyPlatform, FantasyTeam } from '../../types/fantasy';

type HostPlatform = Exclude<FantasyPlatform, 'other'>;

const HOST: Record<HostPlatform, { name: string; home: string; domain: string }> = {
  yahoo: { name: 'Yahoo', home: 'https://hockey.fantasysports.yahoo.com/', domain: 'yahoo.com' },
  espn: { name: 'ESPN', home: 'https://fantasy.espn.com/hockey/', domain: 'espn.com' },
  fantrax: { name: 'Fantrax', home: 'https://www.fantrax.com/', domain: 'fantrax.com' },
};

/** Real team links are well under this; anything longer is a pasted paragraph, not a link. */
const MAX_LINK_LENGTH = 300;

export interface HostLink {
  /** "Yahoo" */
  name: string;
  url: string;
  /** True when it opens the user's own team page. */
  teamPage: boolean;
}

function hostOf(platform: FantasyPlatform): (typeof HOST)[HostPlatform] | null {
  return platform === 'other' ? null : HOST[platform];
}

/**
 * A pasted team link, kept only if it's an https page on the team's platform ("hockey.fantasysports
 * .yahoo.com/hockey/12345/6"). Surrounding text and whitespace are trimmed; anything else is undefined.
 */
export function sanitizeTeamLink(raw: unknown, platform: FantasyPlatform): string | undefined {
  const host = hostOf(platform);
  if (!host || typeof raw !== 'string') return undefined;
  const candidate = raw.trim().match(/https?:\/\/\S+/)?.[0] ?? raw.trim();
  if (!candidate || candidate.length > MAX_LINK_LENGTH) return undefined;
  let url: URL;
  try {
    url = new URL(candidate.startsWith('http') ? candidate : `https://${candidate}`);
  } catch {
    return undefined;
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname !== host.domain && !hostname.endsWith(`.${host.domain}`)) return undefined;
  url.protocol = 'https:';
  return url.toString();
}

/** Where "Open Yahoo" goes for this team, or null when its platform has no app to open. */
export function hostLinkFor(team: Pick<FantasyTeam, 'platform' | 'teamLink'>): HostLink | null {
  const host = hostOf(team.platform);
  if (!host) return null;
  const teamLink = sanitizeTeamLink(team.teamLink, team.platform);
  return { name: host.name, url: teamLink ?? host.home, teamPage: !!teamLink };
}

export function hostName(platform: FantasyPlatform): string | null {
  return hostOf(platform)?.name ?? null;
}
