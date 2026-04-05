# Fantasy Command Center Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform PuckIQ into a freemium fantasy hockey companion with ML-powered projections, roster management, and subscription monetization.

**Architecture:** Extend the existing Expo/React Native app with 2 new tabs (My Team, Hub), Supabase Auth for user accounts, RevenueCat for subscriptions, AdMob for free-tier ads, and an extended ML pipeline producing per-player fantasy point projections. The existing service-layer pattern (Supabase queries → cached results → hooks → components) is preserved throughout.

**Tech Stack:** Expo 54, React Native 0.81, Supabase Auth + Edge Functions, RevenueCat SDK, Google AdMob, Expo Notifications, LightGBM/Poisson GLM (Python ML pipeline)

**Design Doc:** `docs/plans/2026-04-05-fantasy-command-center-design.md`

---

## Phase 1: Foundation — User Accounts & Hub Tab

### Task 1.1: Supabase Auth Integration

**Files:**
- Modify: `lib/supabase.ts` (auth already configured, verify settings)
- Modify: `components/auth/AuthProvider.tsx` (already exists with Apple/Google/email — verify working)
- Create: `services/userSync.ts` (sync local data to Supabase on login)
- Create: `services/__tests__/userSync.test.ts`
- Modify: `app/_layout.tsx` (wrap app in AuthProvider if not already)

**Step 1: Write failing test for userSync service**

```typescript
// services/__tests__/userSync.test.ts
import { syncLocalDataToSupabase, fetchUserData } from '../userSync';

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockResolvedValue({ data: [], error: null }),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe('userSync', () => {
  it('migrates AsyncStorage models to Supabase on first login', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify([{ id: '1', name: 'Test Model' }]));

    await syncLocalDataToSupabase('user-123');

    const { supabase } = require('../../lib/supabase');
    expect(supabase.from).toHaveBeenCalledWith('user_data');
  });

  it('returns null when user has no synced data', async () => {
    const result = await fetchUserData('user-123');
    expect(result).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --testPathPattern=userSync --no-coverage`
Expected: FAIL — module not found

**Step 3: Implement userSync service**

```typescript
// services/userSync.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const STORAGE_KEYS_TO_SYNC = [
  'puckiq_prediction_models',
  'puckiq_daily_picks',
  'puckiq_favorite_teams',
] as const;

export interface UserData {
  userId: string;
  models: any[];
  picks: any;
  favoriteTeams: string[];
  scoringFormat: 'yahoo' | 'espn' | null;
  fantasyRoster: any[] | null;
}

export async function syncLocalDataToSupabase(userId: string): Promise<void> {
  try {
    const localData: Record<string, any> = {};
    for (const key of STORAGE_KEYS_TO_SYNC) {
      const raw = await AsyncStorage.getItem(key);
      if (raw) localData[key] = JSON.parse(raw);
    }

    await supabase.from('user_data').upsert({
      user_id: userId,
      data: localData,
      synced_at: new Date().toISOString(),
    });

    console.log('[USER_SYNC] Local data synced to Supabase');
  } catch (error) {
    console.error('[USER_SYNC] Sync failed:', error);
  }
}

export async function fetchUserData(userId: string): Promise<UserData | null> {
  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;
    return data as UserData;
  } catch {
    return null;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --testPathPattern=userSync --no-coverage`
Expected: PASS

**Step 5: Verify AuthProvider is wired into app layout**

Read `app/_layout.tsx` and `components/auth/AuthProvider.tsx`. If AuthProvider isn't wrapping the app, add it. If it already is, confirm and move on.

**Step 6: Create Supabase migration for user_data table**

```sql
-- Run via Supabase MCP or dashboard
CREATE TABLE IF NOT EXISTS user_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB DEFAULT '{}',
  scoring_format TEXT CHECK (scoring_format IN ('yahoo', 'espn')),
  fantasy_roster JSONB,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own data" ON user_data
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own data" ON user_data
  FOR ALL USING (auth.uid() = user_id);
```

**Step 7: Commit**

```bash
git add services/userSync.ts services/__tests__/userSync.test.ts
git commit -m "feat: add userSync service for local-to-Supabase data migration"
```

---

### Task 1.2: Hub Tab — Account & Settings Screen

**Files:**
- Create: `app/(tabs)/hub.tsx`
- Create: `components/HubScreen.tsx`
- Create: `components/__tests__/HubScreen.test.tsx`
- Modify: `app/(tabs)/_layout.tsx` (add Hub tab)

**Step 1: Write failing test for HubScreen**

```typescript
// components/__tests__/HubScreen.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import HubScreen from '../HubScreen';

jest.mock('../../components/auth/AuthProvider', () => ({
  useAuthContext: () => ({
    user: null,
    signInWithApple: jest.fn(),
    signInWithGoogle: jest.fn(),
    signOut: jest.fn(),
  }),
}));

describe('HubScreen', () => {
  it('shows sign-in buttons when not authenticated', () => {
    render(<HubScreen />);
    expect(screen.getByText(/sign in/i)).toBeTruthy();
  });

  it('shows account info when authenticated', () => {
    jest.spyOn(require('../../components/auth/AuthProvider'), 'useAuthContext')
      .mockReturnValue({
        user: { id: '123', email: 'test@example.com' },
        signOut: jest.fn(),
      });
    render(<HubScreen />);
    expect(screen.getByText('test@example.com')).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --testPathPattern=HubScreen --no-coverage`
Expected: FAIL

**Step 3: Implement HubScreen component**

Build a settings-style screen with sections:
- **Account**: Sign in (Apple/Google/Email) or show email + sign out
- **Subscription**: Current plan status, upgrade CTA (placeholder until RevenueCat)
- **Notifications**: Toggle switches (placeholder until Phase 6)
- **Accuracy Tracker**: Pick accuracy chart (placeholder until Phase 8)
- **About**: Version, support link

Follow the component pattern from `HeroBanner.tsx`: props interface, theme constants, StyleSheet.create at bottom.

**Step 4: Run test to verify it passes**

Run: `npm test -- --testPathPattern=HubScreen --no-coverage`
Expected: PASS

**Step 5: Create hub tab route and add to tab layout**

```typescript
// app/(tabs)/hub.tsx
import HubScreen from '../../components/HubScreen';
export default function Hub() {
  return <HubScreen />;
}
```

Add to `_layout.tsx`:
```typescript
<Tabs.Screen
  name="hub"
  options={{
    title: 'Hub',
    tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.crop.circle.fill" color={color} />,
  }}
/>
```

**Step 6: Run full test suite to verify no regressions**

Run: `npm test -- --no-coverage`
Expected: All previously passing tests still pass

**Step 7: Commit**

```bash
git add app/(tabs)/hub.tsx components/HubScreen.tsx components/__tests__/HubScreen.test.tsx app/(tabs)/_layout.tsx
git commit -m "feat: add Hub tab with account management and settings"
```

---

### Task 1.3: Navigation Restructure — 5-Tab Layout

**Files:**
- Modify: `app/(tabs)/_layout.tsx` (reorder tabs, change default)
- Modify: `app/(tabs)/index.tsx` (rename concept from "Upcoming" to "Today")

**Step 1: Update tab layout to 5-tab structure**

New tab order in `_layout.tsx`:
1. `today` (renamed from `index` — or keep as `index` but change title to "Today")
2. `myteam` (placeholder screen — built in Phase 4)
3. `players` (existing)
4. `stats` (existing Explore tab)
5. `hub` (from Task 1.2)

**Important:** Expo Router uses `index.tsx` as the default route. Keep `index.tsx` as the Today tab for now. My Team becomes the default in Phase 4 when it's fully built.

**Step 2: Create placeholder My Team tab**

```typescript
// app/(tabs)/myteam.tsx
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../constants/theme';

export default function MyTeam() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>My Team — Coming Soon</Text>
      <Text style={styles.subtext}>Set up your fantasy roster to get personalized recommendations</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.lg },
  text: { color: theme.text, fontSize: theme.typography.sizes.xl, fontWeight: '600' },
  subtext: { color: theme.subtext, fontSize: theme.typography.sizes.base, textAlign: 'center', marginTop: theme.spacing.sm },
});
```

**Step 3: Add My Team to tab layout**

```typescript
<Tabs.Screen
  name="myteam"
  options={{
    title: 'My Team',
    tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.2.fill" color={color} />,
  }}
/>
```

**Step 4: Verify navigation works**

Run: `npm start` and test in simulator. Deep link: `exp+learning-project://myteam`

**Step 5: Commit**

```bash
git add app/(tabs)/_layout.tsx app/(tabs)/myteam.tsx
git commit -m "feat: restructure to 5-tab layout with My Team and Hub tabs"
```

---

## Phase 2: Subscription & Monetization

### Task 2.1: RevenueCat SDK Integration

**Files:**
- Create: `services/subscription.ts`
- Create: `services/__tests__/subscription.test.ts`
- Create: `components/SubscriptionProvider.tsx`
- Create: `components/PaywallModal.tsx`
- Create: `components/__tests__/PaywallModal.test.tsx`
- Modify: `package.json` (add `react-native-purchases`)
- Modify: `app.config.js` (add RevenueCat plugin if needed)
- Modify: `app/_layout.tsx` (wrap in SubscriptionProvider)

**Step 1: Install RevenueCat**

```bash
npx expo install react-native-purchases
```

**Step 2: Write failing test for subscription service**

```typescript
// services/__tests__/subscription.test.ts
import { initializeSubscription, isPro, getOfferings, purchasePackage } from '../subscription';

jest.mock('react-native-purchases', () => ({
  Purchases: {
    configure: jest.fn(),
    getOfferings: jest.fn().mockResolvedValue({ current: { monthly: { product: { priceString: '$6.99' } } } }),
    getCustomerInfo: jest.fn().mockResolvedValue({ entitlements: { active: {} } }),
    purchasePackage: jest.fn().mockResolvedValue({ customerInfo: { entitlements: { active: { pro: { isActive: true } } } } }),
  },
}));

describe('subscription service', () => {
  it('initializes RevenueCat with API key', async () => {
    await initializeSubscription();
    const { Purchases } = require('react-native-purchases');
    expect(Purchases.configure).toHaveBeenCalled();
  });

  it('returns false for free users', async () => {
    const result = await isPro();
    expect(result).toBe(false);
  });

  it('returns offerings with monthly and annual packages', async () => {
    const offerings = await getOfferings();
    expect(offerings?.current?.monthly).toBeDefined();
  });
});
```

**Step 3: Run test to verify it fails**

Run: `npm test -- --testPathPattern=subscription.test --no-coverage`
Expected: FAIL

**Step 4: Implement subscription service**

```typescript
// services/subscription.ts
import Purchases, { type CustomerInfo, type PurchasesOfferings, type PurchasesPackage } from 'react-native-purchases';
import { Platform } from 'react-native';

const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || '';
const REVENUECAT_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || '';
const PRO_ENTITLEMENT = 'pro';

export async function initializeSubscription(userId?: string): Promise<void> {
  const apiKey = Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;
  if (!apiKey) {
    console.warn('[SUBSCRIPTION] No RevenueCat API key configured');
    return;
  }
  Purchases.configure({ apiKey, appUserID: userId });
  console.log('[SUBSCRIPTION] RevenueCat initialized');
}

export async function isPro(): Promise<boolean> {
  try {
    const info: CustomerInfo = await Purchases.getCustomerInfo();
    return !!info.entitlements.active[PRO_ENTITLEMENT];
  } catch {
    return false;
  }
}

export async function getOfferings(): Promise<PurchasesOfferings | null> {
  try {
    return await Purchases.getOfferings();
  } catch {
    return null;
  }
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<boolean> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return !!customerInfo.entitlements.active[PRO_ENTITLEMENT];
  } catch (error: any) {
    if (error.userCancelled) return false;
    console.error('[SUBSCRIPTION] Purchase failed:', error);
    throw error;
  }
}

export async function restorePurchases(): Promise<boolean> {
  try {
    const info = await Purchases.restorePurchases();
    return !!info.entitlements.active[PRO_ENTITLEMENT];
  } catch {
    return false;
  }
}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- --testPathPattern=subscription.test --no-coverage`
Expected: PASS

**Step 6: Implement SubscriptionProvider context**

```typescript
// components/SubscriptionProvider.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { initializeSubscription, isPro } from '../services/subscription';
import { useAuthContext } from './auth/AuthProvider';

interface SubscriptionContextType {
  isPremium: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  isPremium: false,
  loading: true,
  refresh: async () => {},
});

export function useSubscription() {
  return useContext(SubscriptionContext);
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthContext();

  const refresh = async () => {
    const pro = await isPro();
    setIsPremium(pro);
  };

  useEffect(() => {
    initializeSubscription(user?.id).then(() => {
      refresh().finally(() => setLoading(false));
    });
  }, [user?.id]);

  return (
    <SubscriptionContext.Provider value={{ isPremium, loading, refresh }}>
      {children}
    </SubscriptionContext.Provider>
  );
}
```

**Step 7: Implement PaywallModal**

A modal that shows when free users tap a premium feature. Shows:
- Feature benefit headline
- Monthly ($6.99/mo) and Annual ($49.99/yr) options
- "Start 7-Day Free Trial" CTA
- "Restore Purchases" link
- Close button

Follow the modal pattern from `GameDeepDiveModal.tsx` or `PlayerDetailModal.tsx`.

**Step 8: Write test for PaywallModal**

Test that it renders offering prices, handles purchase tap, shows restore option.

**Step 9: Run tests, commit**

```bash
git add services/subscription.ts services/__tests__/subscription.test.ts components/SubscriptionProvider.tsx components/PaywallModal.tsx components/__tests__/PaywallModal.test.tsx
git commit -m "feat: add RevenueCat subscription service with PaywallModal"
```

---

### Task 2.2: AdMob Integration (Free Tier)

**Files:**
- Create: `components/BannerAd.tsx`
- Create: `components/__tests__/BannerAd.test.tsx`
- Modify: `package.json` (add `react-native-google-mobile-ads`)
- Modify: `app/(tabs)/index.tsx` (add banner at bottom)
- Modify: `app/(tabs)/players.tsx` (add banner at bottom)

**Step 1: Install AdMob**

```bash
npx expo install react-native-google-mobile-ads
```

**Step 2: Create BannerAd wrapper component**

```typescript
// components/BannerAd.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BannerAd as GADBannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { useSubscription } from './SubscriptionProvider';

const AD_UNIT_ID = __DEV__ ? TestIds.BANNER : (process.env.EXPO_PUBLIC_ADMOB_BANNER_ID || '');

export default function BannerAd() {
  const { isPremium } = useSubscription();
  if (isPremium) return null;

  return (
    <View style={styles.container}>
      <GADBannerAd unitId={AD_UNIT_ID} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 4 },
});
```

**Step 3: Write test — renders nothing for premium users**

```typescript
// components/__tests__/BannerAd.test.tsx
jest.mock('../SubscriptionProvider', () => ({
  useSubscription: () => ({ isPremium: true }),
}));

describe('BannerAd', () => {
  it('renders nothing for premium users', () => {
    const { toJSON } = render(<BannerAd />);
    expect(toJSON()).toBeNull();
  });
});
```

**Step 4: Add BannerAd to Today and Players screens**

Add `<BannerAd />` at the bottom of the ScrollView/FlatList in `index.tsx` and `players.tsx`.

**Step 5: Run tests, commit**

```bash
git add components/BannerAd.tsx components/__tests__/BannerAd.test.tsx app/(tabs)/index.tsx app/(tabs)/players.tsx
git commit -m "feat: add AdMob banner ads on free tier (hidden for Pro users)"
```

---

### Task 2.3: Premium Feature Gates

**Files:**
- Create: `components/PremiumGate.tsx`
- Create: `components/__tests__/PremiumGate.test.tsx`

**Step 1: Write failing test**

```typescript
describe('PremiumGate', () => {
  it('renders children when user is premium', () => {
    // mock isPremium = true
    render(<PremiumGate><Text>Secret Content</Text></PremiumGate>);
    expect(screen.getByText('Secret Content')).toBeTruthy();
  });

  it('renders blurred placeholder with upgrade CTA when free', () => {
    // mock isPremium = false
    render(<PremiumGate feature="ML Predictions"><Text>Secret Content</Text></PremiumGate>);
    expect(screen.getByText(/unlock with pro/i)).toBeTruthy();
    expect(screen.queryByText('Secret Content')).toBeNull();
  });
});
```

**Step 2: Implement PremiumGate**

A wrapper component that either renders its children (premium) or shows a blurred placeholder with "Unlock with PuckIQ Pro" CTA that opens the PaywallModal. Takes a `feature` prop for the CTA message.

**Step 3: Run tests, commit**

```bash
git add components/PremiumGate.tsx components/__tests__/PremiumGate.test.tsx
git commit -m "feat: add PremiumGate component for soft paywall on free tier"
```

---

## Phase 3: ML Fantasy Projections Pipeline

### Task 3.1: Fantasy Scoring Format Definitions

**Files:**
- Create: `ml/fantasy/scoring.py`
- Create: `ml/tests/test_fantasy_scoring.py`

**Step 1: Write failing test**

```python
# ml/tests/test_fantasy_scoring.py
from ml.fantasy.scoring import compute_fantasy_points, SCORING_FORMATS

def test_yahoo_skater_scoring():
    stats = {'goals': 1, 'assists': 2, 'plus_minus': 1, 'ppp': 1, 'sog': 4, 'hits': 2, 'blocks': 1}
    points = compute_fantasy_points(stats, 'yahoo', 'skater')
    # Yahoo default: G=3, A=2, +/-=1, PPP=1, SOG=0.5, Hits=0.5, Blocks=0.5
    expected = 3 + 4 + 1 + 1 + 2 + 1 + 0.5
    assert abs(points - expected) < 0.01

def test_espn_skater_scoring():
    stats = {'goals': 1, 'assists': 2, 'plus_minus': 1, 'ppp': 1, 'sog': 4, 'hits': 2, 'blocks': 1}
    points = compute_fantasy_points(stats, 'espn', 'skater')
    assert isinstance(points, float)

def test_yahoo_goalie_scoring():
    stats = {'wins': 1, 'save_pctg': 0.925, 'gaa': 2.5, 'shutouts': 0}
    points = compute_fantasy_points(stats, 'yahoo', 'goalie')
    assert isinstance(points, float)

def test_formats_are_defined():
    assert 'yahoo' in SCORING_FORMATS
    assert 'espn' in SCORING_FORMATS
```

**Step 2: Run test to verify it fails**

Run: `ml/.venv/bin/python -m pytest ml/tests/test_fantasy_scoring.py -v`
Expected: FAIL — module not found

**Step 3: Implement scoring module**

```python
# ml/fantasy/scoring.py
"""Fantasy point scoring by platform format."""

SCORING_FORMATS = {
    'yahoo': {
        'skater': {
            'goals': 3.0, 'assists': 2.0, 'plus_minus': 1.0,
            'ppp': 1.0, 'sog': 0.5, 'hits': 0.5, 'blocks': 0.5,
        },
        'goalie': {
            'wins': 5.0, 'saves': 0.2, 'goals_against': -1.0,
            'shutouts': 3.0,
        },
    },
    'espn': {
        'skater': {
            'goals': 3.0, 'assists': 2.0, 'plus_minus': 1.0,
            'ppp': 1.0, 'sog': 0.3, 'hits': 0.3, 'blocks': 0.5,
        },
        'goalie': {
            'wins': 5.0, 'saves': 0.2, 'goals_against': -1.0,
            'shutouts': 3.0,
        },
    },
}

def compute_fantasy_points(
    stats: dict[str, float],
    format_name: str,
    player_type: str,  # 'skater' | 'goalie'
) -> float:
    weights = SCORING_FORMATS[format_name][player_type]
    return sum(stats.get(k, 0.0) * w for k, w in weights.items())
```

**Step 4: Run test to verify it passes**

Run: `ml/.venv/bin/python -m pytest ml/tests/test_fantasy_scoring.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add ml/fantasy/__init__.py ml/fantasy/scoring.py ml/tests/test_fantasy_scoring.py
git commit -m "feat(ml): add fantasy scoring format definitions (Yahoo, ESPN)"
```

---

### Task 3.2: Fantasy Points Projection Layer

**Files:**
- Create: `ml/fantasy/projections.py`
- Create: `ml/tests/test_fantasy_projections.py`
- Modify: `ml/pipeline/daily_run.py` (add fantasy projection step)

**Step 1: Write failing test**

```python
# ml/tests/test_fantasy_projections.py
import pandas as pd
import numpy as np
from ml.fantasy.projections import project_fantasy_points

def test_project_fantasy_points_skater():
    """Given raw stat predictions, compute fantasy points per format."""
    predictions = pd.DataFrame({
        'player_id': [8478402, 8477934],
        'pred_goals': [0.45, 0.30],
        'pred_assists': [0.80, 0.55],
        'pred_sog': [3.5, 2.8],
        'pred_hits': [1.2, 0.8],
        'pred_blocks': [0.5, 1.5],
        'pred_ppp': [0.3, 0.2],
        'pred_plus_minus': [0.1, -0.1],
        'position': ['C', 'C'],
    })

    result = project_fantasy_points(predictions, 'yahoo')
    assert 'fantasy_points' in result.columns
    assert 'floor' in result.columns
    assert 'ceiling' in result.columns
    assert len(result) == 2
    assert result.iloc[0]['fantasy_points'] > 0

def test_project_fantasy_points_goalie():
    predictions = pd.DataFrame({
        'player_id': [8479406],
        'pred_wins': [0.55],
        'pred_saves': [28.0],
        'pred_goals_against': [2.3],
        'pred_shutouts': [0.05],
        'position': ['G'],
    })

    result = project_fantasy_points(predictions, 'yahoo')
    assert len(result) == 1
    assert result.iloc[0]['fantasy_points'] > 0
```

**Step 2: Run test to verify it fails**

Run: `ml/.venv/bin/python -m pytest ml/tests/test_fantasy_projections.py -v`
Expected: FAIL

**Step 3: Implement projections module**

```python
# ml/fantasy/projections.py
"""Convert raw stat predictions into fantasy point projections."""
import pandas as pd
import numpy as np
from ml.fantasy.scoring import compute_fantasy_points, SCORING_FORMATS

# Variance multipliers for floor/ceiling (1 std dev)
STAT_VARIANCE = {
    'goals': 0.5, 'assists': 0.6, 'sog': 1.5, 'hits': 1.0,
    'blocks': 0.8, 'ppp': 0.3, 'plus_minus': 1.0,
    'wins': 0.3, 'saves': 5.0, 'goals_against': 1.0, 'shutouts': 0.1,
}

def project_fantasy_points(
    predictions: pd.DataFrame,
    format_name: str,
) -> pd.DataFrame:
    results = []
    for _, row in predictions.iterrows():
        is_goalie = row.get('position', '') == 'G'
        player_type = 'goalie' if is_goalie else 'skater'

        # Map pred_ columns to stat names
        stats = {}
        for col in predictions.columns:
            if col.startswith('pred_'):
                stat_name = col.replace('pred_', '')
                stats[stat_name] = row[col]

        points = compute_fantasy_points(stats, format_name, player_type)

        # Floor/ceiling: ±1 std dev of each stat, recompute points
        floor_stats = {k: max(0, v - STAT_VARIANCE.get(k, 0.3)) for k, v in stats.items()}
        ceiling_stats = {k: v + STAT_VARIANCE.get(k, 0.3) for k, v in stats.items()}

        floor = compute_fantasy_points(floor_stats, format_name, player_type)
        ceiling = compute_fantasy_points(ceiling_stats, format_name, player_type)

        results.append({
            'player_id': row['player_id'],
            'fantasy_points': round(points, 2),
            'floor': round(floor, 2),
            'ceiling': round(ceiling, 2),
            'format': format_name,
        })

    return pd.DataFrame(results)
```

**Step 4: Run test to verify it passes**

Run: `ml/.venv/bin/python -m pytest ml/tests/test_fantasy_projections.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add ml/fantasy/projections.py ml/tests/test_fantasy_projections.py
git commit -m "feat(ml): add fantasy points projection layer with floor/ceiling"
```

---

### Task 3.3: Extend Daily Pipeline with Fantasy Projections

**Files:**
- Modify: `ml/pipeline/daily_run.py` (add `_predict_fantasy_points` step)
- Create: `ml/tests/test_fantasy_pipeline.py`

**Step 1: Write failing test**

```python
# ml/tests/test_fantasy_pipeline.py
from unittest.mock import patch, MagicMock
import pandas as pd

def test_fantasy_projection_step_produces_rows():
    """Fantasy projection step should produce per-player, per-format rows."""
    from ml.pipeline.daily_run import _predict_fantasy_points

    player_predictions = pd.DataFrame({
        'player_id': [8478402],
        'game_id': [2025020100],
        'pred_goals': [0.45],
        'pred_assists': [0.80],
        'pred_sog': [3.5],
        'pred_hits': [1.2],
        'pred_blocks': [0.5],
        'pred_ppp': [0.3],
        'pred_plus_minus': [0.1],
        'position': ['C'],
        'player_name': ['Connor McDavid'],
        'team_abbrev': ['EDM'],
    })

    rows = _predict_fantasy_points(player_predictions)
    assert len(rows) >= 2  # At least yahoo + espn
    assert 'fantasy_points' in rows[0]
    assert 'format' in rows[0]
```

**Step 2: Run test to verify it fails**

Run: `ml/.venv/bin/python -m pytest ml/tests/test_fantasy_pipeline.py -v`
Expected: FAIL — function not found

**Step 3: Implement `_predict_fantasy_points` in daily_run.py**

Add function that:
1. Takes player_predictions DataFrame from existing `_predict_player_props`
2. Calls `project_fantasy_points` for each format ('yahoo', 'espn')
3. Returns list of dicts ready for Supabase write

**Step 4: Create Supabase table for fantasy projections**

```sql
CREATE TABLE IF NOT EXISTS ml_player_projections (
  id BIGSERIAL PRIMARY KEY,
  game_id BIGINT NOT NULL,
  player_id BIGINT NOT NULL,
  player_name TEXT,
  team_abbrev TEXT,
  position TEXT,
  format TEXT NOT NULL,  -- 'yahoo' | 'espn'
  fantasy_points REAL NOT NULL,
  floor REAL,
  ceiling REAL,
  pred_goals REAL,
  pred_assists REAL,
  pred_points REAL,
  pred_sog REAL,
  pred_hits REAL,
  pred_blocks REAL,
  game_date DATE,
  model_version TEXT,
  data_quality TEXT DEFAULT 'fresh',
  predicted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(game_id, player_id, format)
);

ALTER TABLE ml_player_projections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON ml_player_projections
  FOR SELECT USING (true);

CREATE INDEX idx_ml_player_proj_game ON ml_player_projections(game_id);
CREATE INDEX idx_ml_player_proj_date ON ml_player_projections(game_date);
CREATE INDEX idx_ml_player_proj_player ON ml_player_projections(player_id);
```

**Step 5: Run test, commit**

```bash
git add ml/pipeline/daily_run.py ml/tests/test_fantasy_pipeline.py
git commit -m "feat(ml): integrate fantasy projections into daily pipeline"
```

---

### Task 3.4: Start/Sit Scoring Algorithm

**Files:**
- Create: `ml/fantasy/start_sit.py`
- Create: `ml/tests/test_start_sit.py`

**Step 1: Write failing test**

```python
# ml/tests/test_start_sit.py
from ml.fantasy.start_sit import compute_start_sit

def test_must_start_high_floor():
    player = {
        'fantasy_points': 5.2, 'floor': 3.5, 'ceiling': 8.0,
        'is_b2b': False, 'trend': 'HOT', 'opponent_rank': 25,
    }
    result = compute_start_sit(player)
    assert result['recommendation'] == 'START'
    assert result['confidence'] in ('high', 'medium', 'low')

def test_sit_b2b_cold_tough_matchup():
    player = {
        'fantasy_points': 2.1, 'floor': 0.5, 'ceiling': 4.0,
        'is_b2b': True, 'trend': 'COLD', 'opponent_rank': 3,
    }
    result = compute_start_sit(player)
    assert result['recommendation'] == 'SIT'

def test_upside_play():
    player = {
        'fantasy_points': 3.5, 'floor': 0.8, 'ceiling': 9.0,
        'is_b2b': False, 'trend': 'WARM', 'opponent_rank': 28,
    }
    result = compute_start_sit(player)
    assert result['recommendation'] in ('START', 'UPSIDE')
```

**Step 2: Implement start/sit scoring**

```python
# ml/fantasy/start_sit.py
"""Start/sit recommendation engine."""

def compute_start_sit(player: dict) -> dict:
    points = player['fantasy_points']
    floor = player['floor']
    ceiling = player['ceiling']
    is_b2b = player.get('is_b2b', False)
    trend = player.get('trend', 'STEADY')
    opp_rank = player.get('opponent_rank', 16)  # 1=best defense, 32=worst

    # Score components
    projection_score = min(points / 5.0, 1.0)  # Normalize to 0-1
    floor_score = min(floor / 3.0, 1.0)
    matchup_score = opp_rank / 32.0  # Higher = weaker opponent = better
    trend_bonus = {'HOT': 0.2, 'WARM': 0.1, 'STEADY': 0, 'COOL': -0.1, 'COLD': -0.2}.get(trend, 0)
    b2b_penalty = -0.25 if is_b2b else 0

    total = projection_score * 0.4 + floor_score * 0.2 + matchup_score * 0.2 + trend_bonus + b2b_penalty

    if total >= 0.6:
        recommendation = 'START'
    elif total >= 0.4 and (ceiling - floor) > 5.0:
        recommendation = 'UPSIDE'
    elif total >= 0.35:
        recommendation = 'FLEX'
    else:
        recommendation = 'SIT'

    confidence = 'high' if abs(total - 0.5) > 0.2 else ('medium' if abs(total - 0.5) > 0.1 else 'low')

    return {
        'recommendation': recommendation,
        'confidence': confidence,
        'score': round(total, 3),
        'reason': _build_reason(player, recommendation),
    }

def _build_reason(player: dict, rec: str) -> str:
    parts = []
    if player.get('trend') in ('HOT', 'WARM'):
        parts.append(f"trending {player['trend'].lower()}")
    if player.get('is_b2b'):
        parts.append("back-to-back")
    if player.get('opponent_rank', 16) >= 25:
        parts.append("soft matchup")
    elif player.get('opponent_rank', 16) <= 5:
        parts.append("tough matchup")
    return ', '.join(parts) if parts else ''
```

**Step 3: Run test, commit**

```bash
git add ml/fantasy/start_sit.py ml/tests/test_start_sit.py
git commit -m "feat(ml): add start/sit recommendation engine"
```

---

## Phase 4: My Team Screen

### Task 4.1: Fantasy Roster Service

**Files:**
- Create: `services/fantasyRoster.ts`
- Create: `services/__tests__/fantasyRoster.test.ts`
- Create: `types/fantasy.ts`

**Step 1: Define fantasy types**

```typescript
// types/fantasy.ts
export type ScoringFormat = 'yahoo' | 'espn';
export type RosterPosition = 'C' | 'LW' | 'RW' | 'D' | 'G' | 'BN' | 'IR';
export type StartSitRec = 'START' | 'SIT' | 'UPSIDE' | 'FLEX';

export interface FantasyPlayer {
  playerId: number;
  playerName: string;
  teamAbbrev: string;
  position: string;
  rosterPosition: RosterPosition;
}

export interface FantasyRoster {
  id: string;
  name: string;
  scoringFormat: ScoringFormat;
  players: FantasyPlayer[];
  createdAt: string;
  updatedAt: string;
}

export interface PlayerProjection {
  playerId: number;
  playerName: string;
  teamAbbrev: string;
  position: string;
  fantasyPoints: number;
  floor: number;
  ceiling: number;
  predGoals: number;
  predAssists: number;
  predSog: number;
  predHits: number;
  predBlocks: number;
  recommendation: StartSitRec;
  confidence: string;
  reason: string;
  gameId: number;
  opponentAbbrev: string;
  isHome: boolean;
}
```

**Step 2: Write failing test for roster service**

```typescript
// services/__tests__/fantasyRoster.test.ts
import { saveRoster, loadRoster, addPlayerToRoster, removePlayerFromRoster } from '../fantasyRoster';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe('fantasyRoster', () => {
  it('creates a new roster with scoring format', async () => {
    const roster = await saveRoster({ name: 'My Team', scoringFormat: 'yahoo', players: [] });
    expect(roster.id).toBeDefined();
    expect(roster.scoringFormat).toBe('yahoo');
  });

  it('adds a player to the roster', async () => {
    const player = { playerId: 8478402, playerName: 'Connor McDavid', teamAbbrev: 'EDM', position: 'C', rosterPosition: 'C' as const };
    const roster = await addPlayerToRoster('roster-1', player);
    expect(roster.players).toHaveLength(1);
  });

  it('prevents duplicate players', async () => {
    // Should throw or return unchanged
  });
});
```

**Step 3: Implement fantasyRoster service**

Follow the `modelStorage.ts` pattern: AsyncStorage with JSON serialization, CRUD operations, validation on load.

**Step 4: Run tests, commit**

```bash
git add types/fantasy.ts services/fantasyRoster.ts services/__tests__/fantasyRoster.test.ts
git commit -m "feat: add fantasy roster service with AsyncStorage persistence"
```

---

### Task 4.2: Fantasy Projections App Service

**Files:**
- Create: `services/fantasyProjections.ts`
- Create: `services/__tests__/fantasyProjections.test.ts`

**Step 1: Write failing test**

```typescript
// services/__tests__/fantasyProjections.test.ts
import { getProjectionsForRoster, getWaiverWireRecommendations } from '../fantasyProjections';

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [
        { player_id: 8478402, fantasy_points: 5.2, floor: 3.5, ceiling: 8.0, format: 'yahoo' },
      ], error: null }),
    }),
  },
}));

describe('fantasyProjections', () => {
  it('fetches projections for roster players', async () => {
    const projections = await getProjectionsForRoster([8478402], 'yahoo', '2026-04-05');
    expect(projections).toHaveLength(1);
    expect(projections[0].fantasyPoints).toBe(5.2);
  });
});
```

**Step 2: Implement service**

Query `ml_player_projections` table filtered by player IDs, format, and game date. Transform DB rows to `PlayerProjection` type.

Also implement `getWaiverWireRecommendations(format, gameDate)` — fetch top projected players NOT on the user's roster, sorted by fantasy points descending.

**Step 3: Run tests, commit**

```bash
git add services/fantasyProjections.ts services/__tests__/fantasyProjections.test.ts
git commit -m "feat: add fantasy projections service for roster and waiver wire"
```

---

### Task 4.3: My Team Screen Implementation

**Files:**
- Create: `components/MyTeamScreen.tsx`
- Create: `components/__tests__/MyTeamScreen.test.tsx`
- Create: `components/StartSitCard.tsx`
- Create: `components/WeeklyOutlook.tsx`
- Create: `components/WaiverWireSection.tsx`
- Create: `hooks/useMyTeamData.ts`
- Modify: `app/(tabs)/myteam.tsx` (replace placeholder)

**Step 1: Create useMyTeamData hook**

Follow the `useTonightData.ts` pattern: loads roster from fantasyRoster service, fetches projections from fantasyProjections service, computes start/sit recommendations, derives weekly outlook.

```typescript
// hooks/useMyTeamData.ts
export interface MyTeamData {
  isLoading: boolean;
  roster: FantasyRoster | null;
  projections: PlayerProjection[];
  weeklyOutlook: WeeklyOutlook | null;
  waiverPicks: PlayerProjection[];
  hasRoster: boolean;
  onRefresh: () => void;
}
```

**Step 2: Write failing test for MyTeamScreen**

Test that:
- Shows "Set up your roster" CTA when no roster exists
- Shows lineup with start/sit badges when roster exists
- Shows weekly outlook section
- Shows waiver wire section

**Step 3: Implement MyTeamScreen with sub-components**

- `StartSitCard`: Player row with projected points, START/SIT badge, reason text
- `WeeklyOutlook`: Games remaining, category edges/gaps
- `WaiverWireSection`: Top pickup recommendations
- Full screen wrapped in `PremiumGate`

**Step 4: Implement roster builder flow**

A modal/screen where users:
1. Search for players (reuse existing player search from Players tab)
2. Tap to add to roster
3. Assign roster position (C, LW, RW, D, G, BN)
4. Save roster

**Step 5: Wire up to myteam.tsx tab**

Replace the placeholder with the real MyTeamScreen component.

**Step 6: Run full test suite, commit**

```bash
git add hooks/useMyTeamData.ts components/MyTeamScreen.tsx components/StartSitCard.tsx components/WeeklyOutlook.tsx components/WaiverWireSection.tsx components/__tests__/MyTeamScreen.test.tsx app/(tabs)/myteam.tsx
git commit -m "feat: implement My Team screen with start/sit, outlook, and waiver wire"
```

---

### Task 4.4: Matchup Analyzer

**Files:**
- Create: `components/MatchupAnalyzer.tsx`
- Create: `components/__tests__/MatchupAnalyzer.test.tsx`
- Create: `services/matchupAnalysis.ts`
- Create: `services/__tests__/matchupAnalysis.test.ts`

**Step 1: Write failing test for matchup analysis service**

```typescript
describe('matchupAnalysis', () => {
  it('projects category outcomes for two rosters', async () => {
    const result = await analyzeMatchup(myRosterIds, opponentRosterIds, 'yahoo');
    expect(result.categories).toHaveProperty('goals');
    expect(result.categories.goals).toHaveProperty('myTotal');
    expect(result.categories.goals).toHaveProperty('oppTotal');
    expect(result.categories.goals).toHaveProperty('edge'); // 'winning' | 'losing' | 'close'
  });
});
```

**Step 2: Implement matchup analysis service**

Aggregates projected stats across roster, compares category by category, identifies close categories and which players could swing them.

**Step 3: Build MatchupAnalyzer component**

Category-by-category bar chart showing projected edges. Highlight close categories with swap recommendations.

**Step 4: Run tests, commit**

```bash
git add services/matchupAnalysis.ts services/__tests__/matchupAnalysis.test.ts components/MatchupAnalyzer.tsx components/__tests__/MatchupAnalyzer.test.tsx
git commit -m "feat: add weekly matchup analyzer with category projections"
```

---

## Phase 5: Enhanced Players Tab

### Task 5.1: Fantasy Projections on Player Cards

**Files:**
- Modify: `app/(tabs)/players.tsx` (add fantasy projections section)
- Modify: `components/PlayerDetailModal.tsx` (add fantasy tab)
- Modify: `components/CompactPlayerRow.tsx` (show projected fantasy points)

**Step 1: Add "Tonight's Projections" section to Players tab**

Below existing league leaders, add a new section showing tonight's top fantasy point projections. Sorted by projected points. Shows projected points, floor/ceiling, and start/sit badge.

Wrapped in `PremiumGate` for free users.

**Step 2: Add fantasy stats tab to PlayerDetailModal**

New tab in the modal showing:
- Projected fantasy points (by user's scoring format)
- Floor/ceiling range bar
- Start/sit recommendation with reason
- Hit rates for key stat thresholds (goals ≥0.5, assists ≥0.5, SOG ≥2.5)

**Step 3: Run tests, commit**

```bash
git add app/(tabs)/players.tsx components/PlayerDetailModal.tsx components/CompactPlayerRow.tsx
git commit -m "feat: add fantasy projections to Players tab and player detail modal"
```

---

### Task 5.2: Waiver Wire Scout Screen

**Files:**
- Create: `components/WaiverWireScout.tsx`
- Create: `components/__tests__/WaiverWireScout.test.tsx`

**Step 1: Write failing test**

Test that it renders a list of recommended pickups with projected points and trend data.

**Step 2: Implement WaiverWireScout**

Full-screen section accessible from My Team and Players tabs. Shows:
- Top available players sorted by projected fantasy points
- Trending indicators (from existing playerTrends)
- Schedule strength (games this week, opponent quality)
- Excludes players on user's roster

**Step 3: Run tests, commit**

```bash
git add components/WaiverWireScout.tsx components/__tests__/WaiverWireScout.test.tsx
git commit -m "feat: add waiver wire scout with schedule-aware recommendations"
```

---

## Phase 6: Push Notifications

### Task 6.1: Notification Service & Registration

**Files:**
- Modify: `services/notifications.ts` (extend existing)
- Create: `services/__tests__/notifications.test.ts`
- Create: `services/notificationScheduler.ts`

**Step 1: Write failing test for push token registration**

```typescript
describe('notifications', () => {
  it('registers push token with Supabase', async () => {
    const token = await registerForPushNotifications('user-123');
    expect(token).toBeTruthy();
  });

  it('saves notification preferences', async () => {
    await saveNotificationPreferences('user-123', {
      morningBrief: true,
      goalieConfirmed: true,
      injuryAlerts: true,
      gameReminder: false,
      waiverAlerts: false,
    });
  });
});
```

**Step 2: Implement push token registration**

Register device push token with Expo, save to Supabase `push_tokens` table linked to user ID.

**Step 3: Create Supabase table for push tokens and preferences**

```sql
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, token)
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  morning_brief BOOLEAN DEFAULT true,
  goalie_confirmed BOOLEAN DEFAULT true,
  injury_alerts BOOLEAN DEFAULT true,
  game_reminder BOOLEAN DEFAULT false,
  waiver_alerts BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Step 4: Run tests, commit**

```bash
git add services/notifications.ts services/__tests__/notifications.test.ts services/notificationScheduler.ts
git commit -m "feat: add push notification registration and preference storage"
```

---

### Task 6.2: Supabase Edge Functions for Notifications

**Files:**
- Create: `supabase/functions/morning-brief/index.ts`
- Create: `supabase/functions/goalie-confirmed/index.ts`
- Create: `supabase/functions/injury-alert/index.ts`

**Step 1: Implement morning-brief Edge Function**

Runs daily at 9am ET via cron. For each subscribed user:
1. Fetch their roster from `user_data`
2. Fetch today's `ml_player_projections` for roster players
3. Identify start/sit recommendations
4. Format push notification: "3 players active tonight. Huberdeau is a sit — B2B vs DAL"
5. Send via Expo Push API

**Step 2: Implement goalie-confirmed Edge Function**

Triggered by sync pipeline when goalie starters are confirmed. Sends push to users whose roster goalie is confirmed starting.

**Step 3: Implement injury-alert Edge Function**

Triggered by sync pipeline when injury updates detected. Sends push to users whose roster player status changed.

**Step 4: Deploy Edge Functions**

```bash
supabase functions deploy morning-brief
supabase functions deploy goalie-confirmed
supabase functions deploy injury-alert
```

**Step 5: Commit**

```bash
git add supabase/functions/
git commit -m "feat: add Supabase Edge Functions for push notifications"
```

---

### Task 6.3: Notification Settings UI in Hub

**Files:**
- Modify: `components/HubScreen.tsx` (add notification toggles section)

**Step 1: Add notification preferences section to Hub**

Toggle switches for each notification type, reading/writing to `notificationPreferences` service.

**Step 2: Run tests, commit**

```bash
git add components/HubScreen.tsx
git commit -m "feat: add notification preference toggles to Hub screen"
```

---

## Phase 7: Onboarding Flow

### Task 7.1: Onboarding Screens

**Files:**
- Create: `components/onboarding/OnboardingFlow.tsx`
- Create: `components/onboarding/WelcomeScreen.tsx`
- Create: `components/onboarding/PlatformPicker.tsx`
- Create: `components/onboarding/RosterSetup.tsx`
- Create: `components/onboarding/TonightPreview.tsx`
- Create: `components/__tests__/OnboardingFlow.test.tsx`
- Modify: `app/_layout.tsx` (show onboarding on first launch)

**Step 1: Write failing test**

```typescript
describe('OnboardingFlow', () => {
  it('shows welcome screen first', () => {
    render(<OnboardingFlow onComplete={jest.fn()} />);
    expect(screen.getByText(/win your fantasy league/i)).toBeTruthy();
  });

  it('shows platform picker after sign in', () => {
    // Simulate completing step 1
    expect(screen.getByText(/what fantasy platform/i)).toBeTruthy();
  });

  it('calls onComplete when finished', () => {
    const onComplete = jest.fn();
    // Simulate completing all steps
    expect(onComplete).toHaveBeenCalled();
  });
});
```

**Step 2: Implement 4-screen onboarding flow**

- Screen 1 (WelcomeScreen): "PuckIQ — Win Your Fantasy League" + auth buttons + skip
- Screen 2 (PlatformPicker): Yahoo / ESPN / Just browsing
- Screen 3 (RosterSetup): Player search with "add 3-5 players" prompt + skip
- Screen 4 (TonightPreview): Top pick + personalized recommendation + "Start Free Trial" / "Continue Free"

Use `Animated.View` with slide transitions between screens.

**Step 3: Wire into app layout**

Check AsyncStorage for `puckiq_onboarding_complete` flag. If not set, show OnboardingFlow before main tabs.

**Step 4: Run tests, commit**

```bash
git add components/onboarding/ components/__tests__/OnboardingFlow.test.tsx app/_layout.tsx
git commit -m "feat: add 4-screen onboarding flow with auth, platform, roster setup"
```

---

### Task 7.2: "Finish Setup" Nudge Card

**Files:**
- Create: `components/FinishSetupCard.tsx`
- Modify: `app/(tabs)/index.tsx` (show card for incomplete onboarding)

**Step 1: Implement FinishSetupCard**

Shows on Today screen if user skipped onboarding steps. Dismisses after 3 sessions or when setup is completed. Stored in AsyncStorage (`puckiq_setup_nudge_count`).

**Step 2: Run tests, commit**

```bash
git add components/FinishSetupCard.tsx app/(tabs)/index.tsx
git commit -m "feat: add finish-setup nudge card for incomplete onboarding"
```

---

## Phase 8: Social & Viral Features

### Task 8.1: Shareable Pick Cards

**Files:**
- Create: `services/shareCards.ts`
- Create: `components/ShareablePickCard.tsx`
- Modify: `components/HeroBanner.tsx` (enhance share functionality)

**Step 1: Implement shareable card generation**

Use `react-native-view-shot` to capture a styled card as an image. Card shows:
- Game matchup with team logos
- Win probability
- User's pick
- Fantasy projection context (if roster player involved)
- PuckIQ branding + "Get PuckIQ" CTA

**Step 2: Install view-shot**

```bash
npx expo install react-native-view-shot
```

**Step 3: Enhance HeroBanner share button**

Replace current share with the new shareable card image.

**Step 4: Run tests, commit**

```bash
git add services/shareCards.ts components/ShareablePickCard.tsx components/HeroBanner.tsx
git commit -m "feat: add branded shareable pick cards for social sharing"
```

---

### Task 8.2: Accuracy Tracker

**Files:**
- Create: `components/AccuracyTracker.tsx`
- Create: `components/__tests__/AccuracyTracker.test.tsx`
- Create: `services/accuracyStats.ts`
- Modify: `components/HubScreen.tsx` (add accuracy section)

**Step 1: Write failing test**

```typescript
describe('accuracyStats', () => {
  it('calculates accuracy from pick history', async () => {
    const stats = await getAccuracyStats('user-123');
    expect(stats.totalPicks).toBeGreaterThanOrEqual(0);
    expect(stats.accuracy).toBeGreaterThanOrEqual(0);
    expect(stats.accuracy).toBeLessThanOrEqual(1);
  });
});
```

**Step 2: Implement accuracy calculation**

Read from existing `puckiq_daily_picks` AsyncStorage data. Calculate:
- Total picks, correct picks, accuracy %
- Rolling 7-day and 30-day accuracy
- Model comparison (user's model vs default)
- Season summary data

**Step 3: Build AccuracyTracker component**

Line chart showing accuracy over time + summary stats. Shareable as image.

**Step 4: Add to Hub screen**

**Step 5: Run tests, commit**

```bash
git add services/accuracyStats.ts components/AccuracyTracker.tsx components/__tests__/AccuracyTracker.test.tsx components/HubScreen.tsx
git commit -m "feat: add accuracy tracker with historical chart in Hub"
```

---

### Task 8.3: Global Leaderboard

**Files:**
- Create: `components/Leaderboard.tsx`
- Create: `services/leaderboard.ts`
- Modify: `components/HubScreen.tsx` (add leaderboard section)

**Step 1: Create Supabase table**

```sql
CREATE TABLE IF NOT EXISTS leaderboard (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  total_picks INT DEFAULT 0,
  correct_picks INT DEFAULT 0,
  accuracy REAL DEFAULT 0,
  streak INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON leaderboard FOR SELECT USING (true);
CREATE POLICY "Users update own" ON leaderboard FOR ALL USING (auth.uid() = user_id);
```

**Step 2: Implement leaderboard service**

- `getTopPredictors(period: 'week' | 'season', limit: number)`
- `updateUserScore(userId, picks, correct)`
- `setDisplayName(userId, name)`

**Step 3: Build Leaderboard component**

Ranked list with display name, accuracy %, streak. User's own rank highlighted. Opt-in via display name setting in Hub.

**Step 4: Run tests, commit**

```bash
git add services/leaderboard.ts components/Leaderboard.tsx components/HubScreen.tsx
git commit -m "feat: add opt-in global accuracy leaderboard"
```

---

### Task 8.4: Referral Program

**Files:**
- Create: `services/referrals.ts`
- Create: `components/ReferralCard.tsx`
- Modify: `components/HubScreen.tsx` (add referral section)

**Step 1: Implement referral link generation**

Use RevenueCat promo codes. Generate a shareable deep link: `exp+learning-project://referral?code=USER_CODE`.

**Step 2: Build ReferralCard component**

"Give a friend 1 month free, get 1 month free" with share button.

**Step 3: Handle incoming referral links**

In app layout, detect `referral` deep link param. Apply promo code via RevenueCat.

**Step 4: Run tests, commit**

```bash
git add services/referrals.ts components/ReferralCard.tsx components/HubScreen.tsx
git commit -m "feat: add referral program with shareable promo codes"
```

---

## Phase 9: Polish & App Store Prep

### Task 9.1: App Store Metadata

**Files:**
- Modify: `app.config.js` (version bump, privacy manifest)
- Create: `docs/app-store-listing.md` (description, screenshots, keywords)

**Step 1: Update app config**

- Bump version to 3.0.0
- Add `NSUserTrackingUsageDescription` for AdMob
- Add `NSLocationWhenInUseUsageDescription` if needed
- Add privacy manifest for RevenueCat + AdMob

**Step 2: Write app store listing**

Title: "PuckIQ — Fantasy Hockey AI"
Subtitle: "ML-Powered Lineups & Predictions"
Keywords: fantasy hockey, NHL predictions, start sit, waiver wire, hockey analytics, player projections

**Step 3: Commit**

```bash
git add app.config.js docs/app-store-listing.md
git commit -m "chore: prepare app store metadata for v3.0.0 launch"
```

---

### Task 9.2: Integration Testing & QA

**Step 1: Run full test suite**

```bash
npm test -- --no-coverage
ml/.venv/bin/python -m pytest ml/tests/ -x -q
```

**Step 2: Manual QA in simulator**

Use `sim-control.sh` to verify each screen:
1. Onboarding flow (fresh install)
2. Today tab (free user — ads visible, ML picks gated)
3. My Team (premium — start/sit, projections, waiver wire)
4. Players tab (fantasy projections section)
5. Hub (account, subscription, accuracy, notifications)
6. Paywall modal (from any premium gate)
7. Share card generation

**Step 3: Fix any issues found**

**Step 4: Final commit**

```bash
git commit -m "chore: QA fixes and integration test cleanup"
```

---

## Dependency Graph

```
Phase 1 (Foundation) ──→ Phase 2 (Subscription) ──→ Phase 7 (Onboarding)
       │                        │                            │
       │                        └──→ Phase 5 (Players)       │
       │                                                     │
       └──→ Phase 3 (ML Pipeline) ──→ Phase 4 (My Team) ────┘
                                           │
                                           └──→ Phase 6 (Notifications)

Phase 8 (Social) — can run in parallel after Phase 2

Phase 9 (Polish) — after all other phases complete
```

**Parallelizable**: Phase 3 (ML) and Phase 1 (Foundation) can run simultaneously. Phase 8 (Social) can run in parallel with Phases 4-7.
