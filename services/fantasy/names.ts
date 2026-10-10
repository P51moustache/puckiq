/**
 * Player names for tight spots — one copy, shared by the coach's moves, reminders, widgets and
 * Tonight. Every helper is pure and takes the full name as stored on the roster.
 */

/** "Connor McDavid" → { first: "Connor", last: "McDavid" }. A single name is all last name. */
export function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return { first: '', last: fullName.trim() };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
}

/** Last name only ("McDavid"). */
export function lastNameOf(fullName: string): string {
  return splitName(fullName).last;
}

/** Last names, with a first initial where two in the list share one ("J. Hughes", "Q. Hughes"). */
export function shortNames(fullNames: string[]): string[] {
  const lasts = fullNames.map(lastNameOf);
  return fullNames.map((full, index) => {
    const clash = lasts.some((other, j) => j !== index && other === lasts[index]);
    const first = splitName(full).first;
    return clash && first ? `${first[0]}. ${lasts[index]}` : lasts[index];
  });
}
