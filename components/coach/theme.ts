/** Dark player-centered visual system. Shared by existing and new surfaces. */
import type { TextStyle, ViewStyle } from 'react-native';

/** Compact screens share gutters, rounding and a full 44-point primary tap target. */
export const layout = { pageInset: 12, cardRadius: 10, tapTarget: 44 } as const;
export const typography = { pageTitle: 17, hero: 34, section: 14, body: 14, detail: 13 } as const;

export const colors = {
  bg: '#050A0C',
  card: '#10171B',
  raised: '#192126',
  track: '#253036',
  border: 'rgba(225, 235, 245, 0.07)',
  accent: '#FF252D',
  schedule: '#16D4DF',
  scheduleTint: 'rgba(22,212,223,0.08)',
  scheduleEdge: 'rgba(22,212,223,0.28)',
  good: '#29D6A0',
  bad: '#FF5366',
  warn: '#F1B952',
  text: '#F5F7FA',
  sub: '#A8B3BE',
  muted: '#7D8B99',
  onAccent: '#FFFFFF',
  ink: '#0D141A',
  inkRaised: '#1B252E',
  onInk: '#F5F7FA',
  onInkSub: '#A8B3BE',
  elite: '#A155F7',
};

export function display(size: number): TextStyle {
  return {
    fontSize: size,
    fontWeight: '700',
    letterSpacing: size >= 28 ? -0.8 : -0.2,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  };
}

export type Tone =
  'neutral' | 'accent' | 'good' | 'bad' | 'warn' | 'muted' | 'ink';
const TONE_COLORS: Record<Tone, string> = {
  neutral: colors.sub,
  accent: colors.accent,
  good: colors.good,
  bad: colors.bad,
  warn: colors.warn,
  muted: colors.muted,
  ink: colors.text,
};
export function toneColor(tone: Tone): string {
  return TONE_COLORS[tone];
}

export const pressedStyle: ViewStyle = {
  opacity: 0.82,
  transform: [{ scale: 0.99 }],
};
