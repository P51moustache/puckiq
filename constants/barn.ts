/**
 * Frozen Barn tokens. Dark first. Do not add a second theme.
 * Signal is the only primary action fill. Never invert it.
 */

export const BARN_NAME = 'BARN';
export const BARN_OBJECT = 'Lines, waivers, the board.';

export const barn = {
  ground: '#050608',
  glass: '#0C0E12',
  ice: '#10131A',
  board: '#0C0E12',
  ink: '#F2EDE4',
  signal: '#FF2940',
  heat: '#F0B429',
  ghost: '#6E7380',
  rule: 'rgba(242, 237, 228, 0.12)',
  lamp: 'rgba(255, 41, 64, 0.10)',
  fonts: {
    display: 'Display-Bold',
    body: 'Georgia',
    mono: 'SpaceMono',
  },
} as const;

/** In-world lines. Use as-is. Do not explain them. */
export const barnLines = {
  home: 'GOALIE IS A LIFESTYLE',
  emptyWaiver: "Wire's quiet. Nobody wants these guys.",
  injuredStarter: "He's out. You already knew.",
  draftClock: "You're on the clock. Don't get cute.",
  youLost: "You lost. Tape's still on the knob.",
  youWon: "You won. Don't chirp yet.",
  emptyBoard: 'Nobody on the board. Write a name.',
  scratch: 'Healthy scratch. Park him.',
  loading: "Fluorescent's warming up.",
  error: 'Board fell off the clip.',
  lastWeek: "Last week's tape.",
  pair: "Don't pair them. You know why.",
} as const;

export function lastName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return (parts[parts.length - 1] || fullName).toUpperCase();
}

export function splitHero(line: string): [string, string | null] {
  const i = line.lastIndexOf(' ');
  if (i < 8) return [line, null];
  return [line.slice(0, i), line.slice(i + 1)];
}

export function boardHero(input: {
  hasRoster: boolean;
  injuredName?: string;
  scratchName?: string;
  moveAction?: string;
  moveName?: string;
  playing?: number;
}): string {
  if (!input.hasRoster) return barnLines.emptyBoard;
  if (input.injuredName) return barnLines.injuredStarter;
  if (input.scratchName) return barnLines.scratch;
  if (input.moveAction && input.moveName) {
    return `${input.moveAction.toUpperCase()} ${lastName(input.moveName)}`;
  }
  if (input.playing === 0) return barnLines.home;
  return barnLines.home;
}
