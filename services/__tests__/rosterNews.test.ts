import {
  articleMentionsPlayer,
  extractTag,
  fetchRosterNews,
  filterNewsForRoster,
  matchArticleToRoster,
  newsInjuryHintForPlayer,
  parseRssItems,
} from '../rosterNews';
import type { FantasyPlayer } from '../../types/fantasy';

function player(overrides: Partial<FantasyPlayer> = {}): FantasyPlayer {
  return {
    playerId: 8478402,
    playerName: 'Connor McDavid',
    teamAbbrev: 'EDM',
    position: 'C',
    rosterPosition: 'C',
    ...overrides,
  };
}

describe('articleMentionsPlayer', () => {
  it('matches a full name', () => {
    expect(articleMentionsPlayer('Connor McDavid leads Oilers', player())).toBe(true);
  });

  it('matches a last name of 4+ letters', () => {
    expect(articleMentionsPlayer('McDavid on a heater', player())).toBe(true);
  });

  it('does not match a different player', () => {
    expect(articleMentionsPlayer('Auston Matthews scores', player())).toBe(false);
  });

  it('requires the full name for short last names', () => {
    const li = player({ playerId: 1, playerName: 'David Li' });
    expect(articleMentionsPlayer('Li is a common syllable', li)).toBe(false);
    expect(articleMentionsPlayer('David Li signs', li)).toBe(true);
  });
});

describe('matchArticleToRoster', () => {
  it('returns only roster players named in the article', () => {
    const roster = [
      player(),
      player({ playerId: 2, playerName: 'Auston Matthews', teamAbbrev: 'TOR' }),
    ];
    const matched = matchArticleToRoster('McDavid vs Toronto', '', roster);
    expect(matched.ids).toEqual([8478402]);
    expect(matched.names).toEqual(['Connor McDavid']);
  });
});

describe('parseRssItems', () => {
  it('reads CDATA titles and links', () => {
    const xml = `
      <rss><channel>
        <item>
          <title><![CDATA[McDavid update]]></title>
          <link>https://www.espn.com/nhl/story/_/id/1</link>
          <description><![CDATA[Day-to-day]]></description>
          <pubDate>Sat, 22 Aug 2026 12:00:00 GMT</pubDate>
        </item>
        <item>
          <title>No link here</title>
        </item>
      </channel></rss>
    `;
    expect(parseRssItems(xml)).toEqual([{
      title: 'McDavid update',
      url: 'https://www.espn.com/nhl/story/_/id/1',
      summary: 'Day-to-day',
      publishedAt: 'Sat, 22 Aug 2026 12:00:00 GMT',
    }]);
  });
});

describe('extractTag', () => {
  it('strips HTML from a plain tag', () => {
    expect(extractTag('<item><description><p>Hello</p></description></item>', 'description'))
      .toBe('Hello');
  });
});

describe('filterNewsForRoster', () => {
  it('drops articles that do not name a roster player', () => {
    const items = filterNewsForRoster(
      [
        { title: 'McDavid update', url: 'https://example.com/1', summary: '', publishedAt: '' },
        { title: 'League power rankings', url: 'https://example.com/2', summary: '', publishedAt: '' },
      ],
      [player()],
    );
    expect(items).toHaveLength(1);
    expect(items[0].matchedPlayerNames).toEqual(['Connor McDavid']);
  });

  it('returns nothing for an empty roster', () => {
    expect(filterNewsForRoster(
      [{ title: 'McDavid update', url: 'https://example.com/1', summary: '', publishedAt: '' }],
      [],
    )).toEqual([]);
  });
});

describe('newsInjuryHintForPlayer', () => {
  it('reads injury language only from stories that name that player', () => {
    const items = filterNewsForRoster(
      [{ title: 'McDavid placed on IR', url: 'https://example.com/1', summary: '', publishedAt: '' }],
      [player()],
    );
    expect(newsInjuryHintForPlayer(player(), items)).toBe('out');
    expect(newsInjuryHintForPlayer(
      player({ playerId: 9, playerName: 'Auston Matthews' }),
      items,
    )).toBeNull();
  });
});

describe('fetchRosterNews', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns [] for an empty roster', async () => {
    expect(await fetchRosterNews([])).toEqual([]);
  });

  it('parses the public RSS response and filters to the roster', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => `
        <rss><channel>
          <item>
            <title><![CDATA[McDavid placed on IR]]></title>
            <link>https://www.espn.com/nhl/story/_/id/1</link>
            <description><![CDATA[Edmonton]]></description>
          </item>
          <item>
            <title><![CDATA[Power rankings]]></title>
            <link>https://www.espn.com/nhl/story/_/id/2</link>
          </item>
        </channel></rss>
      `,
    });
    const items = await fetchRosterNews([player()]);
    expect(items).toHaveLength(1);
    expect(items[0].matchedPlayerIds).toEqual([8478402]);
  });
});
