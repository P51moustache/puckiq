/** Pure coverage checks keep missing estimates out of actionable lineup recommendations. */
import type { FantasyPlayer } from '../../types/fantasy';
import type { PlayerForm } from './form';
import { isNhlLinked } from './positions';
import { gameForTeam, fantasyGamesOn, type WeekSchedule } from '../nhl/schedule';

export function usableForm(form: PlayerForm | undefined): form is PlayerForm {
  return !!form && form.basis !== 'none' && Number.isFinite(form.value);
}

/** Only players with a fantasy game in the requested date range need an estimate. */
export function lineupCoverageError(
  players: readonly FantasyPlayer[],
  forms: ReadonlyMap<number, PlayerForm>,
  schedule: WeekSchedule,
  onlyDate?: string,
  excluded: ReadonlySet<number> = new Set(),
): string | null {
  const days = schedule.days.filter((day) => !onlyDate || day.date === onlyDate);
  const missing = players.filter((player) =>
    isNhlLinked(player) && !player.injuredReserve && !excluded.has(player.playerId) &&
    !usableForm(forms.get(player.playerId)) &&
    days.some((day) => !!gameForTeam(fantasyGamesOn(day), player.teamAbbrev)),
  );
  if (!missing.length) return null;
  const names = missing.slice(0, 2).map((player) => player.playerName).join(', ');
  return `Player stats unavailable for ${names}${missing.length > 2 ? ` and ${missing.length - 2} more` : ''}. Refresh before using lineup recommendations.`;
}
