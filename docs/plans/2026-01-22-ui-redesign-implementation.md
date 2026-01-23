# PuckIQ UI Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform PuckIQ from a prediction utility into a hockey education app where users learn the game by making picks and seeing what actually matters.

**Architecture:** New 3-tab navigation (Today, Learn, My IQ) replacing the current 4-tab structure. Each game gets a "breakdown" showing 3 key factors. Weekly themes structure learning. Factor Leaderboard tracks what actually predicts wins. Coach's Corner provides bite-sized hockey lessons.

**Tech Stack:** React Native, Expo Router (file-based routing), TypeScript, AsyncStorage for persistence.

**Screenshot Verification:** After each UI change, take a screenshot with `xcrun simctl io booted screenshot /tmp/screenshot.png` and view it with the Read tool to verify the change looks correct.

---

## Phase 0: Foundation

### Task 0.1: Update Tab Navigation to 3 Tabs

**Files:**

- Modify: `app/(tabs)/_layout.tsx`
- Create: `app/(tabs)/learn.tsx`
- Create: `app/(tabs)/myiq.tsx`

**Step 1: Create empty Learn tab page**

Create `app/(tabs)/learn.tsx`:

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/theme';

export default function LearnScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Learn</Text>
      <Text style={styles.subtitle}>Coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 8,
  },
});
```

**Step 2: Create empty My IQ tab page**

Create `app/(tabs)/myiq.tsx`:

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/theme';

export default function MyIQScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Hockey IQ</Text>
      <Text style={styles.subtitle}>Coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 8,
  },
});
```

**Step 3: Update tab layout to show 3 tabs**

Modify `app/(tabs)/_layout.tsx` - replace the Tabs.Screen entries:

```tsx
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { HapticTab } from '../../components/HapticTab';
import { IconSymbol } from '../../components/ui/IconSymbol';
import TabBarBackground from '../../components/ui/TabBarBackground';
import { Colors } from '../../constants/Colors';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.tint,
        tabBarInactiveTintColor: Colors.tabIconDefault,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
          },
          default: {
            backgroundColor: Colors.background,
            borderTopColor: Colors.tabIconDefault,
          },
        }),
      }}>
      {/* Main 3 tabs */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="hockey.puck.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          title: 'Learn',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="book.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="myiq"
        options={{
          title: 'My IQ',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="chart.line.uptrend.xyaxis" color={color} />,
        }}
      />
      {/* Hidden screens - kept for routing but not in tab bar */}
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="models" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="picks" options={{ href: null }} />
      <Tabs.Screen name="mypicks" options={{ href: null }} />
      <Tabs.Screen name="teams" options={{ href: null }} />
      <Tabs.Screen name="more" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}
```

**Step 4: Take screenshot to verify 3-tab navigation**

Run: `xcrun simctl io booted screenshot /tmp/nav_3tabs.png`

Use Read tool on `/tmp/nav_3tabs.png` to verify:

- Bottom nav shows 3 tabs: Today, Learn, My IQ
- Today tab is active by default
- Learn and My IQ show placeholder content when tapped

**Step 5: Commit**

```bash
git add app/(tabs)/learn.tsx app/(tabs)/myiq.tsx app/(tabs)/_layout.tsx
git commit -m "feat: update navigation to 3 tabs (Today, Learn, My IQ)"
```

---

### Task 0.2: Add Settings Gear Icon to Header

**Files:**

- Modify: `app/(tabs)/index.tsx`
- Create: `components/SettingsButton.tsx`

**Step 1: Create SettingsButton component**

Create `components/SettingsButton.tsx`:

```tsx
import { TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { IconSymbol } from './ui/IconSymbol';
import { Colors } from '../constants/theme';

export function SettingsButton() {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={() => router.push('/settings')}
      accessibilityLabel="Settings"
    >
      <IconSymbol name="gearshape.fill" size={24} color={Colors.textSecondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 8,
  },
});
```

**Step 2: Add SettingsButton to Today screen header**

In `app/(tabs)/index.tsx`, find the header section and add the gear icon. Look for the existing header View and add:

```tsx
import { SettingsButton } from '../../components/SettingsButton';

// In the header area, add:
<SettingsButton />
```

**Step 3: Take screenshot to verify gear icon placement**

Run: `xcrun simctl io booted screenshot /tmp/gear_icon.png`

Use Read tool to verify gear icon appears in header.

**Step 4: Commit**

```bash
git add components/SettingsButton.tsx app/(tabs)/index.tsx
git commit -m "feat: add settings gear icon to header"
```

---

## Phase 1: Core Pick Experience

### Task 1.1: Create Factor Types and Data Model

**Files:**

- Create: `types/factors.ts`
- Create: `services/__tests__/factorAnalysis.test.ts`
- Create: `services/factorAnalysis.ts`

**Step 1: Write the failing test for factor types**

Create `services/__tests__/factorAnalysis.test.ts`:

```typescript
import {
  FactorType,
  GameFactor,
  calculateTopFactors,
} from '../factorAnalysis';

describe('factorAnalysis', () => {
  describe('calculateTopFactors', () => {
    it('should return top 3 factors for a game sorted by impact', () => {
      const homeTeam = {
        abbrev: 'CAR',
        homeRecord: '15-3-1',
        recentSavePct: 0.932,
        daysRest: 2,
      };
      const awayTeam = {
        abbrev: 'CHI',
        homeRecord: '10-10-2',
        recentSavePct: 0.891,
        daysRest: 2,
      };

      const factors = calculateTopFactors(homeTeam, awayTeam);

      expect(factors).toHaveLength(3);
      expect(factors[0].type).toBeDefined();
      expect(factors[0].advantage).toBeDefined();
      expect(factors[0].description).toBeDefined();
    });

    it('should identify goalie edge when save percentages differ significantly', () => {
      const homeTeam = { abbrev: 'CAR', recentSavePct: 0.932, daysRest: 2, homeRecord: '15-3-1' };
      const awayTeam = { abbrev: 'CHI', recentSavePct: 0.891, daysRest: 2, homeRecord: '10-10-2' };

      const factors = calculateTopFactors(homeTeam, awayTeam);
      const goalieFactor = factors.find(f => f.type === 'GOALIE_EDGE');

      expect(goalieFactor).toBeDefined();
      expect(goalieFactor?.advantage).toBe('CAR');
    });

    it('should identify home ice advantage', () => {
      const homeTeam = { abbrev: 'CAR', recentSavePct: 0.910, daysRest: 2, homeRecord: '15-3-1' };
      const awayTeam = { abbrev: 'CHI', recentSavePct: 0.910, daysRest: 2, homeRecord: '10-10-2' };

      const factors = calculateTopFactors(homeTeam, awayTeam);
      const homeIceFactor = factors.find(f => f.type === 'HOME_ICE');

      expect(homeIceFactor).toBeDefined();
      expect(homeIceFactor?.advantage).toBe('CAR');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- services/__tests__/factorAnalysis.test.ts`

Expected: FAIL with "Cannot find module '../factorAnalysis'"

**Step 3: Create factor types**

Create `types/factors.ts`:

```typescript
export type FactorType =
  | 'GOALIE_EDGE'
  | 'HOME_ICE'
  | 'REST'
  | 'RECENT_FORM'
  | 'SPECIAL_TEAMS'
  | 'HEAD_TO_HEAD'
  | 'BACK_TO_BACK'
  | 'DIVISIONAL';

export interface GameFactor {
  type: FactorType;
  advantage: string; // Team abbrev or 'EVEN'
  description: string;
  detail: string;
  impact: number; // 0-100, used for sorting
}

export interface FactorAnalysisInput {
  abbrev: string;
  homeRecord?: string;
  recentSavePct?: number;
  daysRest?: number;
  recentForm?: string;
  powerPlayPct?: number;
  penaltyKillPct?: number;
}
```

**Step 4: Write minimal implementation**

Create `services/factorAnalysis.ts`:

```typescript
import { FactorType, GameFactor, FactorAnalysisInput } from '../types/factors';

export { FactorType, GameFactor };

export function calculateTopFactors(
  homeTeam: FactorAnalysisInput,
  awayTeam: FactorAnalysisInput
): GameFactor[] {
  const factors: GameFactor[] = [];

  // Goalie Edge
  if (homeTeam.recentSavePct && awayTeam.recentSavePct) {
    const diff = homeTeam.recentSavePct - awayTeam.recentSavePct;
    if (Math.abs(diff) > 0.01) {
      factors.push({
        type: 'GOALIE_EDGE',
        advantage: diff > 0 ? homeTeam.abbrev : awayTeam.abbrev,
        description: 'GOALIE EDGE',
        detail: `${homeTeam.abbrev} ${(homeTeam.recentSavePct * 100).toFixed(1)}% vs ${awayTeam.abbrev} ${(awayTeam.recentSavePct * 100).toFixed(1)}%`,
        impact: Math.abs(diff) * 1000,
      });
    }
  }

  // Home Ice
  factors.push({
    type: 'HOME_ICE',
    advantage: homeTeam.abbrev,
    description: 'HOME ICE',
    detail: homeTeam.homeRecord ? `${homeTeam.homeRecord} at home` : 'Home team',
    impact: 30,
  });

  // Rest
  const homeDaysRest = homeTeam.daysRest ?? 1;
  const awayDaysRest = awayTeam.daysRest ?? 1;
  const restDiff = homeDaysRest - awayDaysRest;
  factors.push({
    type: 'REST',
    advantage: restDiff > 0 ? homeTeam.abbrev : restDiff < 0 ? awayTeam.abbrev : 'EVEN',
    description: 'REST',
    detail: restDiff === 0
      ? `Both teams ${homeDaysRest} days rest`
      : `${restDiff > 0 ? homeTeam.abbrev : awayTeam.abbrev} more rested`,
    impact: Math.abs(restDiff) * 10,
  });

  // Sort by impact and return top 3
  return factors
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 3);
}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- services/__tests__/factorAnalysis.test.ts`

Expected: PASS

**Step 6: Commit**

```bash
git add types/factors.ts services/factorAnalysis.ts services/__tests__/factorAnalysis.test.ts
git commit -m "feat: add factor analysis service with tests"
```

---

### Task 1.2: Create Breakdown Card Component

**Files:**

- Create: `components/BreakdownCard.tsx`
- Create: `components/__tests__/BreakdownCard.test.tsx`

**Step 1: Write the failing test**

Create `components/__tests__/BreakdownCard.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { BreakdownCard } from '../BreakdownCard';
import { GameFactor } from '../../types/factors';

describe('BreakdownCard', () => {
  const mockFactors: GameFactor[] = [
    {
      type: 'GOALIE_EDGE',
      advantage: 'CAR',
      description: 'GOALIE EDGE',
      detail: 'Andersen .932 vs Mrazek .891',
      impact: 41,
    },
    {
      type: 'HOME_ICE',
      advantage: 'CAR',
      description: 'HOME ICE',
      detail: '15-3-1 at home',
      impact: 30,
    },
    {
      type: 'REST',
      advantage: 'EVEN',
      description: 'REST',
      detail: 'Both teams 2 days rest',
      impact: 0,
    },
  ];

  it('renders game matchup', () => {
    render(
      <BreakdownCard
        awayTeam="CHI"
        homeTeam="CAR"
        gameTime="7:00 PM"
        factors={mockFactors}
        onPickTeam={() => {}}
      />
    );

    expect(screen.getByText('CHI @ CAR')).toBeTruthy();
    expect(screen.getByText('7:00 PM')).toBeTruthy();
  });

  it('renders all three factors', () => {
    render(
      <BreakdownCard
        awayTeam="CHI"
        homeTeam="CAR"
        gameTime="7:00 PM"
        factors={mockFactors}
        onPickTeam={() => {}}
      />
    );

    expect(screen.getByText('GOALIE EDGE')).toBeTruthy();
    expect(screen.getByText('HOME ICE')).toBeTruthy();
    expect(screen.getByText('REST')).toBeTruthy();
  });

  it('renders pick buttons for both teams', () => {
    render(
      <BreakdownCard
        awayTeam="CHI"
        homeTeam="CAR"
        gameTime="7:00 PM"
        factors={mockFactors}
        onPickTeam={() => {}}
      />
    );

    expect(screen.getByText('CHI')).toBeTruthy();
    expect(screen.getByText('CAR')).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- components/__tests__/BreakdownCard.test.tsx`

Expected: FAIL with "Cannot find module '../BreakdownCard'"

**Step 3: Write minimal implementation**

Create `components/BreakdownCard.tsx`:

```tsx
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../constants/theme';
import { GameFactor } from '../types/factors';

interface BreakdownCardProps {
  awayTeam: string;
  homeTeam: string;
  gameTime: string;
  factors: GameFactor[];
  weeklyTheme?: string;
  onPickTeam: (team: string) => void;
  selectedTeam?: string;
}

export function BreakdownCard({
  awayTeam,
  homeTeam,
  gameTime,
  factors,
  weeklyTheme,
  onPickTeam,
  selectedTeam,
}: BreakdownCardProps) {
  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.matchup}>{awayTeam} @ {homeTeam}</Text>
        <Text style={styles.gameTime}>{gameTime}{weeklyTheme ? ` · Theme: ${weeklyTheme}` : ''}</Text>
      </View>

      {/* Breakdown */}
      <View style={styles.breakdown}>
        <Text style={styles.breakdownTitle}>THE BREAKDOWN</Text>
        {factors.map((factor, index) => (
          <View key={index} style={styles.factorRow}>
            <View style={styles.factorHeader}>
              <Text style={styles.factorName}>{factor.description}</Text>
              <Text style={[
                styles.factorAdvantage,
                factor.advantage !== 'EVEN' && styles.factorAdvantageHighlight
              ]}>
                {factor.advantage === 'EVEN' ? 'Even' : `› ${factor.advantage}`}
              </Text>
            </View>
            <Text style={styles.factorDetail}>{factor.detail}</Text>
          </View>
        ))}
      </View>

      {/* Pick Buttons */}
      <View style={styles.pickSection}>
        <Text style={styles.pickPrompt}>Based on this, who wins?</Text>
        <View style={styles.pickButtons}>
          <TouchableOpacity
            style={[
              styles.pickButton,
              selectedTeam === awayTeam && styles.pickButtonSelected,
            ]}
            onPress={() => onPickTeam(awayTeam)}
          >
            <Text style={[
              styles.pickButtonText,
              selectedTeam === awayTeam && styles.pickButtonTextSelected,
            ]}>
              {awayTeam}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.pickButton,
              selectedTeam === homeTeam && styles.pickButtonSelected,
            ]}
            onPress={() => onPickTeam(homeTeam)}
          >
            <Text style={[
              styles.pickButtonText,
              selectedTeam === homeTeam && styles.pickButtonTextSelected,
            ]}>
              {homeTeam}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  header: {
    marginBottom: 16,
  },
  matchup: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  gameTime: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  breakdown: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 16,
  },
  breakdownTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 12,
  },
  factorRow: {
    marginBottom: 12,
  },
  factorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  factorName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  factorAdvantage: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  factorAdvantageHighlight: {
    color: Colors.tint,
    fontWeight: '600',
  },
  factorDetail: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  pickSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 16,
    marginTop: 8,
  },
  pickPrompt: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  pickButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  pickButton: {
    flex: 1,
    backgroundColor: Colors.cardBackgroundLight,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  pickButtonSelected: {
    borderColor: Colors.tint,
    backgroundColor: Colors.tintLight,
  },
  pickButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  pickButtonTextSelected: {
    color: Colors.tint,
  },
});
```

**Step 4: Run test to verify it passes**

Run: `npm test -- components/__tests__/BreakdownCard.test.tsx`

Expected: PASS

**Step 5: Take screenshot to verify card appearance**

Add the BreakdownCard to Today screen temporarily to verify appearance, then screenshot.

Run: `xcrun simctl io booted screenshot /tmp/breakdown_card.png`

Use Read tool to verify the card looks correct.

**Step 6: Commit**

```bash
git add components/BreakdownCard.tsx components/__tests__/BreakdownCard.test.tsx
git commit -m "feat: add BreakdownCard component with 3-factor display"
```

---

### Task 1.3: Create Results Card Component

**Files:**

- Create: `components/ResultsCard.tsx`
- Create: `components/__tests__/ResultsCard.test.tsx`

**Step 1: Write the failing test**

Create `components/__tests__/ResultsCard.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ResultsCard } from '../ResultsCard';

describe('ResultsCard', () => {
  const mockProps = {
    awayTeam: 'CHI',
    homeTeam: 'CAR',
    awayScore: 2,
    homeScore: 4,
    userPick: 'CAR',
    factors: [
      {
        type: 'GOALIE_EDGE' as const,
        advantage: 'CAR',
        description: 'GOALIE EDGE',
        detail: 'Andersen: 31 saves, .939',
        impact: 41,
        mattered: true,
        resultNote: 'This was the difference.',
      },
      {
        type: 'HOME_ICE' as const,
        advantage: 'CAR',
        description: 'HOME ICE',
        detail: 'CAR scored 2 in the 1st',
        impact: 30,
        mattered: true,
        resultNote: 'Home crowd energy paid off.',
      },
      {
        type: 'REST' as const,
        advantage: 'EVEN',
        description: 'REST',
        detail: 'CHI actually outshot CAR',
        impact: 0,
        mattered: false,
        resultNote: 'Fatigue wasn\'t a factor.',
      },
    ],
    insight: 'Goaltending and home ice were real. Rest was noise tonight.',
  };

  it('renders final score', () => {
    render(<ResultsCard {...mockProps} />);

    expect(screen.getByText(/CAR 4 - CHI 2/)).toBeTruthy();
    expect(screen.getByText(/FINAL/)).toBeTruthy();
  });

  it('shows correct pick result', () => {
    render(<ResultsCard {...mockProps} />);

    expect(screen.getByText(/You picked CAR/)).toBeTruthy();
  });

  it('renders factors with checkmarks and X marks', () => {
    render(<ResultsCard {...mockProps} />);

    expect(screen.getByText('GOALIE EDGE')).toBeTruthy();
    expect(screen.getByText('HOME ICE')).toBeTruthy();
    expect(screen.getByText('REST')).toBeTruthy();
  });

  it('renders insight summary', () => {
    render(<ResultsCard {...mockProps} />);

    expect(screen.getByText(/Goaltending and home ice were real/)).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- components/__tests__/ResultsCard.test.tsx`

Expected: FAIL

**Step 3: Write minimal implementation**

Create `components/ResultsCard.tsx`:

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/theme';
import { GameFactor } from '../types/factors';

interface ResultFactor extends GameFactor {
  mattered: boolean;
  resultNote: string;
}

interface ResultsCardProps {
  awayTeam: string;
  homeTeam: string;
  awayScore: number;
  homeScore: number;
  userPick: string;
  factors: ResultFactor[];
  insight: string;
}

export function ResultsCard({
  awayTeam,
  homeTeam,
  awayScore,
  homeScore,
  userPick,
  factors,
  insight,
}: ResultsCardProps) {
  const winner = homeScore > awayScore ? homeTeam : awayTeam;
  const userWon = userPick === winner;

  return (
    <View style={styles.card}>
      {/* Header with score */}
      <View style={styles.header}>
        <Text style={styles.score}>
          {homeTeam} {homeScore} - {awayTeam} {awayScore}
        </Text>
        <Text style={styles.final}>FINAL</Text>
      </View>

      <View style={styles.pickResult}>
        <Text style={[styles.pickResultText, userWon ? styles.pickWin : styles.pickLoss]}>
          {userWon ? '✓' : '✗'} You picked {userPick}
        </Text>
      </View>

      {/* What actually mattered */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>WHAT ACTUALLY MATTERED</Text>
        {factors.map((factor, index) => (
          <View key={index} style={styles.factorRow}>
            <View style={styles.factorHeader}>
              <Text style={[
                styles.factorIcon,
                factor.mattered ? styles.factorMattered : styles.factorNotMattered
              ]}>
                {factor.mattered ? '✓' : '✗'}
              </Text>
              <Text style={styles.factorName}>{factor.description}</Text>
            </View>
            <Text style={styles.factorDetail}>{factor.detail}</Text>
            <Text style={styles.factorNote}>{factor.resultNote}</Text>
          </View>
        ))}
      </View>

      {/* Insight */}
      <View style={styles.insightSection}>
        <Text style={styles.insightTitle}>YOUR INSIGHT</Text>
        <Text style={styles.insightText}>{insight}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  score: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  final: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  pickResult: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 16,
  },
  pickResultText: {
    fontSize: 14,
    fontWeight: '600',
  },
  pickWin: {
    color: Colors.success,
  },
  pickLoss: {
    color: Colors.error,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 12,
  },
  factorRow: {
    marginBottom: 16,
  },
  factorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  factorIcon: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  factorMattered: {
    color: Colors.success,
  },
  factorNotMattered: {
    color: Colors.error,
  },
  factorName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  factorDetail: {
    fontSize: 13,
    color: Colors.text,
    marginTop: 4,
    marginLeft: 24,
  },
  factorNote: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 2,
    marginLeft: 24,
  },
  insightSection: {
    backgroundColor: Colors.cardBackgroundLight,
    borderRadius: 8,
    padding: 12,
  },
  insightTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 8,
  },
  insightText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
});
```

**Step 4: Run test to verify it passes**

Run: `npm test -- components/__tests__/ResultsCard.test.tsx`

Expected: PASS

**Step 5: Take screenshot to verify card appearance**

Run: `xcrun simctl io booted screenshot /tmp/results_card.png`

Use Read tool to verify the results card looks correct.

**Step 6: Commit**

```bash
git add components/ResultsCard.tsx components/__tests__/ResultsCard.test.tsx
git commit -m "feat: add ResultsCard component showing what factors mattered"
```

---

### Task 1.4: Create Weekly Theme Data Model

**Files:**

- Create: `types/weeklyTheme.ts`
- Create: `services/__tests__/weeklyTheme.test.ts`
- Create: `services/weeklyTheme.ts`

**Step 1: Write the failing test**

Create `services/__tests__/weeklyTheme.test.ts`:

```typescript
import {
  WeeklyTheme,
  getCurrentTheme,
  getThemeForDate,
  THEME_ROTATION,
} from '../weeklyTheme';

describe('weeklyTheme', () => {
  describe('getCurrentTheme', () => {
    it('should return a valid theme', () => {
      const theme = getCurrentTheme();

      expect(theme.id).toBeDefined();
      expect(theme.name).toBeDefined();
      expect(theme.description).toBeDefined();
      expect(theme.factorType).toBeDefined();
    });
  });

  describe('getThemeForDate', () => {
    it('should return consistent theme for same week', () => {
      const monday = new Date('2026-01-19');
      const wednesday = new Date('2026-01-21');

      const mondayTheme = getThemeForDate(monday);
      const wednesdayTheme = getThemeForDate(wednesday);

      expect(mondayTheme.id).toBe(wednesdayTheme.id);
    });

    it('should return different theme for different weeks', () => {
      const week1 = new Date('2026-01-19');
      const week2 = new Date('2026-01-26');

      const theme1 = getThemeForDate(week1);
      const theme2 = getThemeForDate(week2);

      expect(theme1.id).not.toBe(theme2.id);
    });
  });

  describe('THEME_ROTATION', () => {
    it('should have at least 8 themes', () => {
      expect(THEME_ROTATION.length).toBeGreaterThanOrEqual(8);
    });

    it('should have unique IDs', () => {
      const ids = THEME_ROTATION.map(t => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- services/__tests__/weeklyTheme.test.ts`

Expected: FAIL

**Step 3: Create types**

Create `types/weeklyTheme.ts`:

```typescript
import { FactorType } from './factors';

export interface WeeklyTheme {
  id: string;
  name: string;
  description: string;
  factorType: FactorType;
  lessonIntro: string;
  difficulty: 'fundamental' | 'intermediate' | 'advanced';
}
```

**Step 4: Write minimal implementation**

Create `services/weeklyTheme.ts`:

```typescript
import { WeeklyTheme } from '../types/weeklyTheme';
import { FactorType } from '../types/factors';

export { WeeklyTheme };

export const THEME_ROTATION: WeeklyTheme[] = [
  {
    id: 'home-ice',
    name: 'Home Ice Advantage',
    description: 'How playing at home affects outcomes',
    factorType: 'HOME_ICE',
    lessonIntro: 'Home teams win about 55% of NHL games. This week, we explore why the home crowd, last change, and familiar surroundings matter.',
    difficulty: 'fundamental',
  },
  {
    id: 'goaltending',
    name: 'Goaltending',
    description: 'The impact of hot and cold goalies',
    factorType: 'GOALIE_EDGE',
    lessonIntro: 'A hot goalie can steal games. A cold one can sink a favorite. This week, we track how goalie performance affects outcomes.',
    difficulty: 'fundamental',
  },
  {
    id: 'rest-fatigue',
    name: 'Rest & Fatigue',
    description: 'How rest and schedule affect performance',
    factorType: 'REST',
    lessonIntro: 'Back-to-back games, long road trips, and schedule density all matter. This week, we see when fatigue is real and when it\'s overrated.',
    difficulty: 'fundamental',
  },
  {
    id: 'recent-form',
    name: 'Recent Form',
    description: 'Riding hot streaks and cold slumps',
    factorType: 'RECENT_FORM',
    lessonIntro: 'Teams get hot. Teams go cold. This week, we learn how to read momentum and when streaks are predictive.',
    difficulty: 'fundamental',
  },
  {
    id: 'special-teams',
    name: 'Special Teams',
    description: 'Power plays and penalty kills',
    factorType: 'SPECIAL_TEAMS',
    lessonIntro: 'Special teams can swing games. This week, we explore how power play and penalty kill percentages predict winners.',
    difficulty: 'intermediate',
  },
  {
    id: 'divisional',
    name: 'Divisional Rivalries',
    description: 'When familiarity breeds unpredictability',
    factorType: 'DIVISIONAL',
    lessonIntro: 'Division games are different. Teams know each other. This week, we see how familiarity affects predictions.',
    difficulty: 'intermediate',
  },
  {
    id: 'back-to-back',
    name: 'Back-to-Back Games',
    description: 'The real impact of no rest',
    factorType: 'BACK_TO_BACK',
    lessonIntro: 'Everyone talks about back-to-backs. But how much do they actually matter? This week, we find out.',
    difficulty: 'intermediate',
  },
  {
    id: 'head-to-head',
    name: 'Head-to-Head History',
    description: 'When past matchups predict future results',
    factorType: 'HEAD_TO_HEAD',
    lessonIntro: 'Some teams just own other teams. This week, we explore when head-to-head history matters.',
    difficulty: 'intermediate',
  },
];

// Season start date - themes rotate from here
const SEASON_START = new Date('2025-10-06');

export function getWeekNumber(date: Date): number {
  const diffTime = date.getTime() - SEASON_START.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7);
}

export function getThemeForDate(date: Date): WeeklyTheme {
  const weekNum = getWeekNumber(date);
  const themeIndex = weekNum % THEME_ROTATION.length;
  return THEME_ROTATION[themeIndex];
}

export function getCurrentTheme(): WeeklyTheme {
  return getThemeForDate(new Date());
}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- services/__tests__/weeklyTheme.test.ts`

Expected: PASS

**Step 6: Commit**

```bash
git add types/weeklyTheme.ts services/weeklyTheme.ts services/__tests__/weeklyTheme.test.ts
git commit -m "feat: add weekly theme rotation system"
```

---

## Remaining Tasks (Summary)

The following tasks follow the same TDD pattern. Each includes:
1. Write failing test
2. Run to verify failure
3. Write minimal implementation
4. Run to verify pass
5. Screenshot to verify UI
6. Commit

### Phase 1 Remaining:

- **Task 1.5:** Integrate BreakdownCard into Today screen
- **Task 1.6:** Add factor analysis to game data fetching

### Phase 2: Weekly Theme System

- **Task 2.1:** Create ThemeBanner component
- **Task 2.2:** Add theme banner to Today screen
- **Task 2.3:** Highlight theme-related factors in breakdowns
- **Task 2.4:** Create WeeklyRecap screen
- **Task 2.5:** Track weekly user stats

### Phase 3: Learn Tab

- **Task 3.1:** Create FactorLeaderboard component
- **Task 3.2:** Build factor tracking storage
- **Task 3.3:** Create CoachsCorner page structure
- **Task 3.4:** Create Lesson component
- **Task 3.5:** Add "Go Deeper" links to BreakdownCard
- **Task 3.6:** Integrate Teams/Players into Learn tab

### Phase 4: My IQ Tab

- **Task 4.1:** Create accuracy tracking service
- **Task 4.2:** Create factor profile tracking
- **Task 4.3:** Create MyIQDashboard component
- **Task 4.4:** Create PickHistory component
- **Task 4.5:** Create Milestones component

### Phase 5: Content

- **Task 5.1:** Create lesson markdown template
- **Task 5.2:** Write fundamental lessons (10)
- **Task 5.3:** Write advanced lessons (10)
- **Task 5.4:** Write weekly theme intros

### Phase 6: Onboarding & Notifications

- **Task 6.1:** Create Onboarding flow (4 screens)
- **Task 6.2:** Create daily insight generation
- **Task 6.3:** Create weekly trend detection
- **Task 6.4:** Set up notification scheduling

### Phase 7: Polish

- **Task 7.1:** Typography and spacing audit
- **Task 7.2:** Color palette refinement
- **Task 7.3:** Add animations for milestones
- **Task 7.4:** Create empty and error states

---

## Screenshot Verification Checklist

After completing each major UI task, verify with screenshots:

| Task | Screenshot Command | What to Verify |
|------|-------------------|----------------|
| 0.1 | `xcrun simctl io booted screenshot /tmp/nav.png` | 3-tab nav visible |
| 0.2 | `xcrun simctl io booted screenshot /tmp/gear.png` | Gear icon in header |
| 1.2 | `xcrun simctl io booted screenshot /tmp/breakdown.png` | Breakdown card layout |
| 1.3 | `xcrun simctl io booted screenshot /tmp/results.png` | Results card layout |
| 2.1 | `xcrun simctl io booted screenshot /tmp/theme.png` | Theme banner |
| 3.1 | `xcrun simctl io booted screenshot /tmp/leaderboard.png` | Factor leaderboard |
| 3.3 | `xcrun simctl io booted screenshot /tmp/coach.png` | Coach's Corner |
| 4.3 | `xcrun simctl io booted screenshot /tmp/myiq.png` | My IQ dashboard |
| 6.1 | `xcrun simctl io booted screenshot /tmp/onboard.png` | Each onboarding screen |
