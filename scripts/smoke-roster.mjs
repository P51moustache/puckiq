/**
 * Live smoke: search NHL players, tonight slate, filtered public RSS.
 * Usage: node scripts/smoke-roster.mjs
 */
const roster = [
  { playerId: 8478402, playerName: 'Connor McDavid', teamAbbrev: 'EDM', position: 'C' },
  { playerId: 8477934, playerName: 'Leon Draisaitl', teamAbbrev: 'EDM', position: 'C' },
  { playerId: 8479318, playerName: 'Auston Matthews', teamAbbrev: 'TOR', position: 'C' },
  { playerId: 8477492, playerName: 'Nathan MacKinnon', teamAbbrev: 'COL', position: 'C' },
  { playerId: 8476453, playerName: 'Nikita Kucherov', teamAbbrev: 'TBL', position: 'RW' },
  { playerId: 8471214, playerName: 'Alex Ovechkin', teamAbbrev: 'WSH', position: 'LW' },
  { playerId: 8471675, playerName: 'Sidney Crosby', teamAbbrev: 'PIT', position: 'C' },
  { playerId: 8480012, playerName: 'Cale Makar', teamAbbrev: 'COL', position: 'D' },
  { playerId: 8475167, playerName: 'Victor Hedman', teamAbbrev: 'TBL', position: 'D' },
  { playerId: 8476887, playerName: 'Igor Shesterkin', teamAbbrev: 'NYR', position: 'G' },
  { playerId: 8476883, playerName: 'Andrei Vasilevskiy', teamAbbrev: 'TBL', position: 'G' },
  { playerId: 8477956, playerName: 'David Pastrnak', teamAbbrev: 'BOS', position: 'RW' },
];

function nhlDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(now);
}

async function main() {
  const q = 'mcdavid';
  const searchRes = await fetch(`https://search.d3.nhle.com/api/v1/search/player?culture=en-us&limit=5&q=${q}`);
  const search = await searchRes.json();
  console.log('SEARCH', searchRes.status, search.slice(0, 2).map((p) => `${p.name} ${p.teamAbbrev}`));

  const date = nhlDate();
  const scoreRes = await fetch(`https://api-web.nhle.com/v1/score/${date}`);
  const score = await scoreRes.json();
  console.log('SLATE', date, 'games', (score.games || []).length, 'next', score.nextDate);

  const rssRes = await fetch('https://www.espn.com/espn/rss/nhl/news');
  const xml = await rssRes.text();
  const items = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((m) => {
    const block = m[0];
    const title = (block.match(/<title[^>]*>\s*(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))/) || [])[1]
      || (block.match(/<title[^>]*>\s*(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))/) || [])[2]
      || '';
    return title;
  });
  const filtered = items.filter((title) =>
    roster.some((p) => title.toLowerCase().includes(p.playerName.split(' ').pop().toLowerCase())),
  );
  console.log('NEWS total', items.length, 'roster-filtered', filtered.length);
  filtered.slice(0, 8).forEach((t) => console.log(' -', t));
  console.log('ROSTER_SIZE', roster.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
