# Hero Matchup Card Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a compact frosted-glass hero card to the Today tab that spotlights the day's top fantasy matchup (or next upcoming game on off-days).

**Architecture:** Single new component `HeroMatchupCard` receives game data, prediction confidence, and a date label from the existing `useTonightData()` hook. The hook already provides `heroGame`, `heroPrediction`, `heroConfidence`, and `gamesByDate` for upcoming games — no new data fetching needed. The component renders a 130px glass card with team logos, records, a confidence bar, and an entry animation.

**Tech Stack:** React Native, expo-image (team logos), react-native-reanimated (FadeInDown entry), rinkGlass design tokens, LinearGradient (team color tint)

---

### Task 1: Create HeroMatchupCard Component

**Files:**
- Create: `components/HeroMatchupCard.tsx`

**Step 1: Create the component file**

```tsx
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { rinkGlass } from '../constants/theme';
import { getTeamColors } from '../constants/teamColors';
import { getTeamLogoUrl } from '../utils/teamLogo';

interface HeroMatchupCardProps {
  game: {
    homeTeam: { abbrev: string; score?: number };
    awayTeam: { abbrev: string; score?: number };
    startTimeUTC?: string;
    gameDate?: string;
    gameState?: string;
  };
  homeRecord?: string;
  awayRecord?: string;
  confidence?: number;       // 0-100, e.g. 85
  favoredTeam?: string;      // abbrev of the team the model favors
  dateLabel?: string;        // "Tomorrow", "Tuesday, Apr 8", etc.
  isNextUp?: boolean;        // true = off-day preview, false = today's matchup
}

function formatGameTime(startTimeUTC?: string): string {
  if (!startTimeUTC) return '';
  try {
    const d = new Date(startTimeUTC);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return '';
  }
}

export default function HeroMatchupCard({
  game,
  homeRecord,
  awayRecord,
  confidence,
  favoredTeam,
  dateLabel,
  isNextUp = false,
}: HeroMatchupCardProps) {
  const away = game.awayTeam.abbrev;
  const home = game.homeTeam.abbrev;
  const awayColors = getTeamColors(away);
  const homeColors = getTeamColors(home);

  const gameTime = formatGameTime(game.startTimeUTC);
  const timeDisplay = isNextUp && dateLabel
    ? `${dateLabel} · ${gameTime}`
    : gameTime;

  const badgeLabel = isNextUp ? 'NEXT UP' : 'MATCHUP OF THE DAY';
  const badgeColor = isNextUp ? rinkGlass.blueLight : rinkGlass.faceoffDot;

  const hasConfidence = !isNextUp && confidence != null && confidence > 0 && favoredTeam;
  const barWidth = hasConfidence ? `${confidence}%` : '0%';

  return (
    <Animated.View
      entering={FadeInDown.duration(500).springify().damping(18).stiffness(140)}
      style={styles.wrapper}
    >
      <LinearGradient
        colors={[awayColors.primary + '14', 'transparent', homeColors.primary + '14']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.container}
      >
        {/* Top row: badge + time */}
        <View style={styles.topRow}>
          <View style={[styles.badge, { backgroundColor: badgeColor }]}>
            <Text style={styles.badgeText}>{badgeLabel}</Text>
          </View>
          <Text style={styles.timeText}>{timeDisplay}</Text>
        </View>

        {/* Center: logos + VS */}
        <View style={styles.matchupRow}>
          <View style={styles.teamCol}>
            <Image
              source={{ uri: getTeamLogoUrl(away) }}
              style={styles.logo}
              contentFit="contain"
            />
            <Text style={styles.teamAbbrev}>{away}</Text>
            {awayRecord ? <Text style={styles.record}>{awayRecord}</Text> : null}
          </View>

          <Text style={styles.vsText}>VS</Text>

          <View style={styles.teamCol}>
            <Image
              source={{ uri: getTeamLogoUrl(home) }}
              style={styles.logo}
              contentFit="contain"
            />
            <Text style={styles.teamAbbrev}>{home}</Text>
            {homeRecord ? <Text style={styles.record}>{homeRecord}</Text> : null}
          </View>
        </View>

        {/* Bottom: confidence bar (game-day only) */}
        {hasConfidence && (
          <View style={styles.confidenceRow}>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: barWidth as any }]} />
            </View>
            <Text style={styles.confidenceText}>
              {confidence}% {favoredTeam}
            </Text>
          </View>
        )}
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
  },
  container: {
    backgroundColor: rinkGlass.glass,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: rinkGlass.glassBorder,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  timeText: {
    fontSize: 12,
    color: rinkGlass.textSecondary,
    fontFamily: rinkGlass.fonts.mono,
  },
  matchupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 10,
  },
  teamCol: {
    alignItems: 'center',
    width: 80,
  },
  logo: {
    width: 44,
    height: 44,
    marginBottom: 4,
  },
  teamAbbrev: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 16,
    color: rinkGlass.textPrimary,
    letterSpacing: 1,
  },
  record: {
    fontSize: 11,
    color: rinkGlass.textMuted,
    marginTop: 1,
  },
  vsText: {
    fontFamily: rinkGlass.fonts.display,
    fontSize: 14,
    color: rinkGlass.textMuted,
    letterSpacing: 2,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  barTrack: {
    flex: 1,
    height: 4,
    backgroundColor: rinkGlass.glassHighlight,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: 4,
    backgroundColor: rinkGlass.faceoffDot,
    borderRadius: 2,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '700',
    color: rinkGlass.faceoffDot,
    fontFamily: rinkGlass.fonts.mono,
    minWidth: 70,
    textAlign: 'right',
  },
});
```

**Step 2: Commit**

```bash
git add components/HeroMatchupCard.tsx
git commit -m "feat: add HeroMatchupCard component"
```

---

### Task 2: Write Tests for HeroMatchupCard

**Files:**
- Create: `components/__tests__/HeroMatchupCard.test.tsx`

**Step 1: Write tests**

```tsx
jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: ({ children, ...props }: any) => React.createElement('View', props, children),
    Text: ({ children, ...props }: any) => React.createElement('Text', props, children),
    StyleSheet: {
      create: (s: any) => s,
    },
    Platform: { OS: 'ios', select: (opts: any) => opts.ios },
  };
});

jest.mock('expo-image', () => {
  const React = require('react');
  return {
    Image: (props: any) => React.createElement('Image', props),
  };
});

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  return {
    LinearGradient: ({ children, ...props }: any) => React.createElement('View', props, children),
  };
});

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: {
      View: ({ children, ...props }: any) => React.createElement('View', props, children),
    },
    FadeInDown: {
      duration: () => ({
        springify: () => ({
          damping: () => ({
            stiffness: () => ({}),
          }),
        }),
      }),
    },
  };
});

import React from 'react';
import { render } from '@testing-library/react-native';
import HeroMatchupCard from '../HeroMatchupCard';

const mockGame = {
  homeTeam: { abbrev: 'EDM' },
  awayTeam: { abbrev: 'CGY' },
  startTimeUTC: '2026-04-07T02:00:00Z',
  gameDate: '2026-04-06',
};

describe('HeroMatchupCard', () => {
  it('renders team abbreviations', () => {
    const { getByText } = render(<HeroMatchupCard game={mockGame} />);
    expect(getByText('EDM')).toBeTruthy();
    expect(getByText('CGY')).toBeTruthy();
  });

  it('renders VS divider', () => {
    const { getByText } = render(<HeroMatchupCard game={mockGame} />);
    expect(getByText('VS')).toBeTruthy();
  });

  it('shows MATCHUP OF THE DAY badge by default', () => {
    const { getByText } = render(<HeroMatchupCard game={mockGame} />);
    expect(getByText('MATCHUP OF THE DAY')).toBeTruthy();
  });

  it('shows NEXT UP badge when isNextUp is true', () => {
    const { getByText } = render(
      <HeroMatchupCard game={mockGame} isNextUp dateLabel="Tomorrow" />
    );
    expect(getByText('NEXT UP')).toBeTruthy();
  });

  it('renders team records when provided', () => {
    const { getByText } = render(
      <HeroMatchupCard game={mockGame} homeRecord="39-29-9" awayRecord="32-36-8" />
    );
    expect(getByText('39-29-9')).toBeTruthy();
    expect(getByText('32-36-8')).toBeTruthy();
  });

  it('renders confidence bar when confidence is provided on game day', () => {
    const { getByText } = render(
      <HeroMatchupCard game={mockGame} confidence={85} favoredTeam="EDM" />
    );
    expect(getByText('85% EDM')).toBeTruthy();
  });

  it('hides confidence bar on off-day (isNextUp)', () => {
    const { queryByText } = render(
      <HeroMatchupCard game={mockGame} confidence={85} favoredTeam="EDM" isNextUp dateLabel="Tomorrow" />
    );
    expect(queryByText('85% EDM')).toBeNull();
  });

  it('shows date label with time for next-up games', () => {
    const { getByText } = render(
      <HeroMatchupCard game={mockGame} isNextUp dateLabel="Tomorrow" />
    );
    // Should show "Tomorrow · [time]"
    const timeElement = getByText(/Tomorrow/);
    expect(timeElement).toBeTruthy();
  });

  it('does not render records when not provided', () => {
    const { queryByText } = render(<HeroMatchupCard game={mockGame} />);
    expect(queryByText('39-29-9')).toBeNull();
  });
});
```

**Step 2: Run tests to verify they pass**

Run: `npx jest components/__tests__/HeroMatchupCard.test.tsx --no-coverage`
Expected: 8 tests PASS

**Step 3: Commit**

```bash
git add components/__tests__/HeroMatchupCard.test.tsx
git commit -m "test: add HeroMatchupCard tests"
```

---

### Task 3: Wire HeroMatchupCard into Today Tab

**Files:**
- Modify: `app/(tabs)/index.tsx`

**Step 1: Add imports and extract hero data from useTonightData**

At the top of `index.tsx`, add:
```tsx
import HeroMatchupCard from '../../components/HeroMatchupCard';
```

Extract additional fields from `useTonightData()`:
```tsx
const {
  isLoading,
  refreshing,
  onRefresh,
  todaysGames,
  gameCount,
  toastMessage,
  currentStandings,
  heroGame,
  heroPrediction,
  heroConfidence,
  hasGamesToday,
  isShowingUpcoming,
  gamesByDate,
} = useTonightData();
```

**Step 2: Build hero card data and derive team records from standings**

After the `selectedTeam` state, add a helper to extract records:

```tsx
const heroCardData = React.useMemo(() => {
  // Game-day: use heroGame
  if (hasGamesToday && heroGame) {
    const homeAbbrev = heroGame.homeTeam?.abbrev;
    const awayAbbrev = heroGame.awayTeam?.abbrev;
    let homeRecord: string | undefined;
    let awayRecord: string | undefined;

    if (currentStandings) {
      const standings = Array.isArray(currentStandings)
        ? currentStandings
        : currentStandings?.standings ?? [];
      for (const s of standings) {
        if (s.teamAbbrev === homeAbbrev) homeRecord = `${s.wins}-${s.losses}-${s.otLosses}`;
        if (s.teamAbbrev === awayAbbrev) awayRecord = `${s.wins}-${s.losses}-${s.otLosses}`;
      }
    }

    const favoredTeam = heroPrediction
      ? (heroPrediction.homeWinProb >= 0.5 ? homeAbbrev : awayAbbrev)
      : undefined;
    const confidence = heroConfidence
      ? Math.round(heroConfidence * 100)
      : undefined;

    return { game: heroGame, homeRecord, awayRecord, confidence, favoredTeam, isNextUp: false };
  }

  // Off-day: use first upcoming game
  if (isShowingUpcoming && gamesByDate?.length > 0) {
    const nextGroup = gamesByDate[0];
    const nextGame = nextGroup.games[0];
    if (nextGame) {
      return {
        game: nextGame,
        dateLabel: nextGroup.label,
        isNextUp: true,
      };
    }
  }

  return null;
}, [hasGamesToday, heroGame, heroPrediction, heroConfidence, currentStandings, isShowingUpcoming, gamesByDate]);
```

**Step 3: Render the hero card between header and Command Center**

Replace the area between the LiveNowBar and DashboardContainer with:

```tsx
{/* HERO MATCHUP CARD — top fantasy matchup spotlight */}
{!isLoading && heroCardData && (
  <HeroMatchupCard
    game={heroCardData.game}
    homeRecord={heroCardData.homeRecord}
    awayRecord={heroCardData.awayRecord}
    confidence={heroCardData.confidence}
    favoredTeam={heroCardData.favoredTeam}
    dateLabel={heroCardData.dateLabel}
    isNextUp={heroCardData.isNextUp}
  />
)}
```

Place this right after the LiveNowBar block (after line 82) and before the DashboardContainer block.

**Step 4: Commit**

```bash
git add app/\(tabs\)/index.tsx
git commit -m "feat: wire HeroMatchupCard into Today tab"
```

---

### Task 4: Verify in Simulator

**Step 1: Verify the hero card renders**

```bash
./scripts/sim-control.sh navigate "/" && sleep 3 && ./scripts/sim-control.sh screenshot /tmp/hero_verify.png
```

Check the screenshot shows the hero card between the PuckIQ header and Command Center.

**Step 2: Verify off-day state**

If no games today, the card should show "NEXT UP" with tomorrow's game. Verify team logos load, abbreviations display, and the card uses the glass treatment.

**Step 3: Run all tests**

```bash
npx jest components/__tests__/HeroMatchupCard.test.tsx components/dashboard/__tests__/ --no-coverage
```

Expected: All tests PASS.

**Step 4: Final commit if any adjustments needed**
