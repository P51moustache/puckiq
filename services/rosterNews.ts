/**
 * Public RSS news filtered to MY roster.
 * NHL.com RSS currently serves HTML; ESPN NHL RSS is a public syndication feed.
 * Do not add Left Wing Lock, Daily Faceoff, or RotoWire.
 */

import type { FantasyPlayer, RosterNewsItem } from '../types/fantasy';
import { injurySignalFromText } from './startSitLean';
import { appNow } from './nhl/dates';

export const ESPN_NHL_RSS_URL = 'https://www.espn.com/espn/rss/nhl/news';

const SHORT_LAST_NAME = 3;
// News is a tentative hint, never a replacement for tonight's NHL scratch list.
const INJURY_NEWS_MAX_AGE_MS = 48 * 60 * 60 * 1000;
const NEWS_CLOCK_TOLERANCE_MS = 5 * 60 * 1000;

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function articleMentionsPlayer(text: string, player: FantasyPlayer): boolean {
  const hay = text.toLowerCase();
  const full = player.playerName.trim().toLowerCase();
  if (full.length >= 5 && hay.includes(full)) return true;

  const parts = player.playerName.trim().split(/\s+/);
  const last = parts[parts.length - 1] ?? '';
  if (last.length <= SHORT_LAST_NAME) {
    return full.length > 0 && hay.includes(full);
  }
  const re = new RegExp(`\\b${escapeRegExp(last)}\\b`, 'i');
  return re.test(text);
}

export function matchArticleToRoster(
  title: string,
  summary: string,
  roster: FantasyPlayer[],
): { ids: number[]; names: string[] } {
  const text = `${title}\n${summary}`;
  const ids: number[] = [];
  const names: string[] = [];
  for (const player of roster) {
    if (articleMentionsPlayer(text, player)) {
      ids.push(player.playerId);
      names.push(player.playerName);
    }
  }
  return { ids, names };
}

export function extractTag(block: string, tag: string): string {
  const cdata = block.match(new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>`, 'i'));
  if (cdata?.[1]) return cdata[1].trim();
  const plain = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  if (!plain?.[1]) return '';
  return plain[1].replace(/<[^>]+>/g, '').trim();
}

export function parseRssItems(xml: string): Array<{ title: string; url: string; summary: string; publishedAt: string }> {
  const items: Array<{ title: string; url: string; summary: string; publishedAt: string }> = [];
  const re = /<item\b[\s\S]*?<\/item>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    const block = match[0];
    const title = extractTag(block, 'title');
    const url = extractTag(block, 'link');
    if (!title || !url) continue;
    items.push({
      title,
      url,
      summary: extractTag(block, 'description'),
      publishedAt: extractTag(block, 'pubDate'),
    });
  }
  return items;
}

export function filterNewsForRoster(
  articles: Array<{ title: string; url: string; summary: string; publishedAt: string }>,
  roster: FantasyPlayer[],
  source = 'ESPN NHL',
): RosterNewsItem[] {
  if (roster.length === 0) return [];
  return articles.flatMap((article, index) => {
    const matched = matchArticleToRoster(article.title, article.summary, roster);
    if (matched.ids.length === 0) return [];
    return [{
      id: `${source}:${article.url}:${index}`,
      title: article.title,
      url: article.url,
      summary: article.summary,
      publishedAt: article.publishedAt,
      source,
      matchedPlayerIds: matched.ids,
      matchedPlayerNames: matched.names,
    }];
  });
}

export function newsInjuryHintForPlayer(
  player: FantasyPlayer,
  news: RosterNewsItem[],
  now: Date = appNow(),
): ReturnType<typeof injurySignalFromText> {
  for (const item of news) {
    if (!item.matchedPlayerIds.includes(player.playerId)) continue;
    const published = Date.parse(item.publishedAt);
    const age = now.getTime() - published;
    if (!Number.isFinite(published) || age < -NEWS_CLOCK_TOLERANCE_MS || age > INJURY_NEWS_MAX_AGE_MS) continue;
    const clauses = `${item.title}\n${item.summary}`.split(/[.!?;\n]+/);
    for (const clause of clauses) {
      if (!articleMentionsPlayer(clause, player)) continue;
      // A sentence about several roster players cannot reliably attribute an injury.
      const otherPlayer = item.matchedPlayerNames.some((name, index) =>
        item.matchedPlayerIds[index] !== player.playerId &&
        articleMentionsPlayer(clause, { ...player, playerName: name }),
      );
      if (otherPlayer || /\b(no longer|not|off|removed from|activated from|returns? from)\b/i.test(clause)) continue;
      const signal = injurySignalFromText(clause);
      if (signal) return signal;
    }
  }
  return null;
}

const FEED_TTL_MS = 5 * 60 * 1000;
let feedCache: { items: ReturnType<typeof parseRssItems>; fetchedAt: number } | null = null;

export function clearRosterNewsCache(): void {
  feedCache = null;
}

export async function fetchRosterNews(roster: FantasyPlayer[]): Promise<RosterNewsItem[]> {
  if (roster.length === 0) return [];
  if (!feedCache || Date.now() - feedCache.fetchedAt > FEED_TTL_MS) {
    const res = await fetch(ESPN_NHL_RSS_URL, {
      headers: { Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8' },
    });
    if (!res.ok) {
      throw new Error(`Roster news feed failed (${res.status})`);
    }
    feedCache = { items: parseRssItems(await res.text()), fetchedAt: Date.now() };
  }
  return filterNewsForRoster(feedCache.items, roster);
}
