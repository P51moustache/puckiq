/**
 * Public RSS news filtered to MY roster.
 * NHL.com RSS currently serves HTML; ESPN NHL RSS is a public syndication feed.
 * Do not add Left Wing Lock, Daily Faceoff, or RotoWire.
 */

import type { FantasyPlayer, RosterNewsItem } from '../types/fantasy';
import { injurySignalFromText } from './startSitLean';

export const ESPN_NHL_RSS_URL = 'https://www.espn.com/espn/rss/nhl/news';

const SHORT_LAST_NAME = 3;

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
): ReturnType<typeof injurySignalFromText> {
  for (const item of news) {
    if (!item.matchedPlayerIds.includes(player.playerId)) continue;
    const signal = injurySignalFromText(`${item.title} ${item.summary}`);
    if (signal) return signal;
  }
  return null;
}

export async function fetchRosterNews(roster: FantasyPlayer[]): Promise<RosterNewsItem[]> {
  if (roster.length === 0) return [];
  const res = await fetch(ESPN_NHL_RSS_URL, {
    headers: { Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8' },
  });
  if (!res.ok) {
    throw new Error(`Roster news feed failed (${res.status})`);
  }
  const xml = await res.text();
  return filterNewsForRoster(parseRssItems(xml), roster);
}
