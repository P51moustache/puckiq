/**
 * Live smoke test: the whole coach pipeline against the real NHL APIs.
 * Not part of `npm test` (network). Run: npm run smoke:coach
 */

import { searchNhlPlayers } from '../../services/nhlPlayerSearch';
import { buildCoachMoves } from '../../services/fantasy/coach';
import { loadNight, loadPickupPool, loadPlayerForms, valuesOf } from '../../services/fantasy/loaders';
import { likelyRosteredIds, rankPickups } from '../../services/fantasy/pickups';
import { buildWeekPlan } from '../../services/fantasy/weekPlan';
import { compareWeeks } from '../../services/fantasy/matchup';
import { formatValue } from '../../services/fantasy/scoring';
import { createTeam } from '../../services/teams';
import { mondayOf } from '../../services/nhl/dates';
import { fetchWeekSchedule } from '../../services/nhl/schedule';
import type { FantasyPlayer } from '../../types/fantasy';

jest.setTimeout(120_000);

// jest.setup silences console.log; smoke output goes straight to stdout.
const log = (...parts: unknown[]) => process.stdout.write(`${parts.join(' ')}\n`);

const MINE = ['Connor McDavid', 'Auston Matthews', 'Nikita Kucherov', 'David Pastrnak', 'Kirill Kaprizov', 'Jack Hughes',
  'Brady Tkachuk', 'Cale Makar', 'Quinn Hughes', 'Rasmus Dahlin', 'Evan Bouchard', 'Igor Shesterkin', 'Connor Hellebuyck', 'Jake Oettinger'];
const THEIRS = ['Nathan MacKinnon', 'Leon Draisaitl', 'Mitch Marner', 'Mikko Rantanen', 'Adam Fox', 'Zach Werenski', 'Andrei Vasilevskiy'];

async function resolve(names: string[]): Promise<FantasyPlayer[]> {
  const out: FantasyPlayer[] = [];
  for (const name of names) {
    const [hit] = (await searchNhlPlayers(name, 5)).filter((row) => row.active);
    if (hit) out.push({ playerId: hit.playerId, playerName: hit.name, teamAbbrev: hit.teamAbbrev, position: hit.position, rosterPosition: 'BN' });
  }
  return out;
}

describe('coach pipeline (live NHL data)', () => {
  it('builds forms, a week plan, tonight, coach moves, pickups, and a matchup', async () => {
    const players = await resolve(MINE);
    const opponent = await resolve(THEIRS);
    expect(players.length).toBeGreaterThanOrEqual(12);
    const team = { ...createTeam({ name: 'Smoke', players }), opponent };

    const today = process.env.SMOKE_DATE ?? '2026-10-07';
    const forms = await loadPlayerForms([...players, ...opponent], team.scoring, today);
    log('FORMS basis:', [...forms.forms.values()].map((f) => f.basis).join(','), 'currentSeason:', forms.hasCurrentSeason);
    for (const player of players) {
      const form = forms.forms.get(player.playerId);
      log(`  ${player.playerName.padEnd(20)} ${player.position} ${player.teamAbbrev} value=${formatValue(form?.value ?? 0)} season=${formatValue(form?.seasonRate ?? 0)} gs=${form?.isGoalie ? Math.round((form?.startShare ?? 0) * 100) + '%' : '-'}`);
    }
    expect([...forms.forms.values()].every((form) => Number.isFinite(form.value))).toBe(true);
    expect(forms.teamStrength.size).toBeGreaterThanOrEqual(32);

    const schedule = await fetchWeekSchedule(mondayOf(today));
    const values = valuesOf(forms.forms);
    const plan = buildWeekPlan({ schedule, players, slots: team.slots, values, today });
    log('WEEK', schedule.monday, 'games/day:', plan.days.map((d) => `${d.dayAbbrev}:${d.leagueGames}${d.offNight ? '*' : ''}`).join(' '));
    log('  totals', JSON.stringify(plan.week), 'remaining', JSON.stringify(plan.remaining));
    expect(plan.week.games).toBeGreaterThan(0);

    const theirPlan = buildWeekPlan({ schedule, players: opponent, slots: team.slots, values, today });
    log('MATCHUP', JSON.stringify(compareWeeks(plan, theirPlan)));

    const night = await loadNight(players, today);
    const day = plan.days.find((d) => d.date === today)!;
    log('NIGHT', today, 'games:', night.games.length, 'mine playing:', Object.keys(night.playerGames).length, 'next:', night.nextDate, 'news:', night.news.length);
    const moves = buildCoachMoves({ day, players, games: night.playerGames, statuses: night.statuses, forms: forms.forms });
    for (const move of moves) log(`  [${move.kind}] ${move.title} — ${move.detail}`);

    const pool = await loadPickupPool(today, team.scoring, new Set(players.map((p) => p.playerId)));
    log('POOL', pool.candidates.length, 'candidates; currentSeason:', pool.hasCurrentSeason);
    expect(pool.candidates.length).toBeGreaterThan(100);
    const owned = likelyRosteredIds(pool.candidates, team.leagueSize, team.slots);
    const available = pool.candidates.filter((c) => !owned.has(c.playerId));
    log('LIKELY OWNED', owned.size, 'available', available.length);
    const pickups = rankPickups({ schedule, plan, roster: players, slots: team.slots, values, candidates: available, today });
    for (const row of pickups.slice(0, 8)) {
      log(`  +${formatValue(row.gain)} ${row.name.padEnd(22)} ${row.position} ${row.team} games=${row.remainingGames} usable=${row.usableGames} fills=${row.emptyFills} off=${row.offNightGames}`);
    }
    expect(pickups.length).toBeGreaterThan(0);
  });

  it('reads a finished slate: scores, scratches, and box-score lines', async () => {
    const date = process.env.SMOKE_FINAL_DATE ?? '2026-04-14';
    const players = await resolve(['Connor McDavid', 'Auston Matthews', 'Cale Makar', 'Connor Hellebuyck']);
    const night = await loadNight(players, date);
    log('FINAL NIGHT', date, 'games:', night.games.length, 'states:', [...new Set(night.games.map((g) => g.state))].join(','));
    for (const [id, line] of night.liveLines) {
      const name = players.find((p) => p.playerId === id)?.playerName;
      log(`  ${name}: ${line.isGoalie ? `${line.saves} SV ${line.goalsAgainst} GA` : `${line.goals}G ${line.assists}A ${line.shots} SOG ${line.hits} HIT`}`);
    }
    expect(night.games.length).toBeGreaterThan(0);
  });
});
