import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
const STORAGE_KEYS = {
  USER_WALLET: 'puckiq_user_wallet',
  LOCKED_PICKS: 'puckiq_locked_picks',
  PUCK_HISTORY: 'puckiq_puck_history',
};

// Confidence levels and their multipliers
export const CONFIDENCE_LEVELS = {
  casual: { label: 'Casual', cost: 50, multiplier: 1, description: 'Low risk, low reward' },
  confident: { label: 'Confident', cost: 100, multiplier: 1.5, description: 'Moderate risk' },
  allIn: { label: 'All In', cost: 250, multiplier: 2, description: 'High risk, high reward' },
  yolo: { label: 'YOLO', cost: 500, multiplier: 3, description: 'Once per day max payout' },
} as const;

export type ConfidenceLevel = keyof typeof CONFIDENCE_LEVELS;

export interface UserWallet {
  balance: number;
  lifetimeEarnings: number;
  lifetimeLosses: number;
  dailyAllocation: number;
  bonusFromStreak: number;
  lastRefillDate: string; // YYYY-MM-DD
  yoloUsedToday: boolean;
  totalPicksLocked: number;
  totalWins: number;
  totalLosses: number;
}

export interface LockedPick {
  id: string;
  gameId: string;
  date: string; // YYYY-MM-DD
  homeTeam: string;
  awayTeam: string;
  predictedWinner: string;
  confidenceLevel: ConfidenceLevel;
  pucksWagered: number;
  multiplier: number;
  potentialReturn: number;
  lockedAt: string; // ISO timestamp
  outcome?: 'win' | 'loss' | 'push';
  pucksEarned?: number;
  isChallengingAI?: boolean; // True if user picked opposite of AI recommendation
}

export interface PuckTransaction {
  id: string;
  type: 'daily_allocation' | 'streak_bonus' | 'pick_win' | 'pick_loss' | 'pick_locked';
  amount: number;
  balance: number;
  description: string;
  timestamp: string;
  pickId?: string;
}

// Get today's date string
const getTodayString = (): string => {
  return new Date().toISOString().split('T')[0];
};

// Calculate streak bonus (50 pucks per day, max 500)
const calculateStreakBonus = (currentStreak: number): number => {
  return Math.min(currentStreak * 50, 500);
};

// Initialize or get wallet
export const getWallet = async (): Promise<UserWallet> => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.USER_WALLET);
    if (stored) {
      const wallet: UserWallet = JSON.parse(stored);
      return wallet;
    }
  } catch (error) {
    console.error('[WALLET] Error loading wallet:', error);
  }

  // Return default wallet
  return {
    balance: 0,
    lifetimeEarnings: 0,
    lifetimeLosses: 0,
    dailyAllocation: 500,
    bonusFromStreak: 0,
    lastRefillDate: '',
    yoloUsedToday: false,
    totalPicksLocked: 0,
    totalWins: 0,
    totalLosses: 0,
  };
};

// Save wallet
export const saveWallet = async (wallet: UserWallet): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.USER_WALLET, JSON.stringify(wallet));
  } catch (error) {
    console.error('[WALLET] Error saving wallet:', error);
  }
};

// Check and perform daily refill if needed
export const checkDailyRefill = async (currentStreak: number): Promise<UserWallet> => {
  const wallet = await getWallet();
  const today = getTodayString();

  if (wallet.lastRefillDate !== today) {
    // New day - refill!
    const streakBonus = calculateStreakBonus(currentStreak);
    const dailyAmount = 500 + streakBonus;

    wallet.balance += dailyAmount;
    wallet.dailyAllocation = 500;
    wallet.bonusFromStreak = streakBonus;
    wallet.lastRefillDate = today;
    wallet.yoloUsedToday = false;

    await saveWallet(wallet);

    // Log the transaction
    await logTransaction({
      type: 'daily_allocation',
      amount: 500,
      balance: wallet.balance - streakBonus,
      description: 'Daily Puck allocation',
    });

    if (streakBonus > 0) {
      await logTransaction({
        type: 'streak_bonus',
        amount: streakBonus,
        balance: wallet.balance,
        description: `${currentStreak}-day streak bonus!`,
      });
    }

    console.log(`[WALLET] Daily refill: +${dailyAmount} Pucks (500 base + ${streakBonus} streak bonus)`);
  }

  return wallet;
};

// Lock in a pick
export const lockPick = async (
  gameId: string,
  homeTeam: string,
  awayTeam: string,
  predictedWinner: string,
  confidenceLevel: ConfidenceLevel,
  isChallengingAI: boolean = false
): Promise<{ success: boolean; error?: string; pick?: LockedPick; wallet?: UserWallet }> => {
  try {
    const wallet = await getWallet();
    const config = CONFIDENCE_LEVELS[confidenceLevel];

    // Check if YOLO already used today
    if (confidenceLevel === 'yolo' && wallet.yoloUsedToday) {
      return { success: false, error: 'YOLO pick already used today!' };
    }

    // Check sufficient balance
    if (wallet.balance < config.cost) {
      return { success: false, error: `Insufficient Pucks! Need ${config.cost}, have ${wallet.balance}` };
    }

    // Check if pick already locked for this game
    const existingPicks = await getLockedPicks();
    const alreadyLocked = existingPicks.find(p => p.gameId === gameId && p.date === getTodayString());
    if (alreadyLocked) {
      return { success: false, error: 'You already locked a pick for this game!' };
    }

    // Deduct pucks
    wallet.balance -= config.cost;
    wallet.totalPicksLocked += 1;
    if (confidenceLevel === 'yolo') {
      wallet.yoloUsedToday = true;
    }

    // Create locked pick
    const pick: LockedPick = {
      id: `pick_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      gameId,
      date: getTodayString(),
      homeTeam,
      awayTeam,
      predictedWinner,
      confidenceLevel,
      pucksWagered: config.cost,
      multiplier: config.multiplier,
      potentialReturn: Math.round(config.cost * config.multiplier),
      lockedAt: new Date().toISOString(),
      isChallengingAI,
    };

    // Save everything
    await saveWallet(wallet);
    await saveLockedPick(pick);

    // Log transaction
    await logTransaction({
      type: 'pick_locked',
      amount: -config.cost,
      balance: wallet.balance,
      description: `Locked ${predictedWinner} (${config.label})`,
      pickId: pick.id,
    });

    console.log(`[WALLET] Locked pick: ${predictedWinner} for ${config.cost} Pucks`);

    return { success: true, pick, wallet };
  } catch (error) {
    console.error('[WALLET] Error locking pick:', error);
    return { success: false, error: 'Failed to lock pick' };
  }
};

// Get all locked picks
export const getLockedPicks = async (): Promise<LockedPick[]> => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.LOCKED_PICKS);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('[WALLET] Error loading locked picks:', error);
  }
  return [];
};

// Get locked picks for today
export const getTodaysLockedPicks = async (): Promise<LockedPick[]> => {
  const allPicks = await getLockedPicks();
  const today = getTodayString();
  return allPicks.filter(p => p.date === today);
};

// Save a locked pick
const saveLockedPick = async (pick: LockedPick): Promise<void> => {
  try {
    const existing = await getLockedPicks();
    existing.push(pick);
    await AsyncStorage.setItem(STORAGE_KEYS.LOCKED_PICKS, JSON.stringify(existing));
  } catch (error) {
    console.error('[WALLET] Error saving locked pick:', error);
  }
};

// Resolve a pick (called when game results come in)
export const resolvePick = async (
  pickId: string,
  actualWinner: string
): Promise<{ success: boolean; pucksEarned: number; wallet?: UserWallet }> => {
  try {
    const picks = await getLockedPicks();
    const pickIndex = picks.findIndex(p => p.id === pickId);

    if (pickIndex === -1) {
      return { success: false, pucksEarned: 0 };
    }

    const pick = picks[pickIndex];
    const wallet = await getWallet();

    // Determine outcome
    const isWin = pick.predictedWinner === actualWinner;
    pick.outcome = isWin ? 'win' : 'loss';

    if (isWin) {
      // Winner! Apply multiplier
      let pucksEarned = pick.potentialReturn;

      // Extra bonus if challenging AI and winning
      if (pick.isChallengingAI) {
        pucksEarned = Math.round(pucksEarned * 1.5);
      }

      pick.pucksEarned = pucksEarned;
      wallet.balance += pucksEarned;
      wallet.lifetimeEarnings += pucksEarned;
      wallet.totalWins += 1;

      await logTransaction({
        type: 'pick_win',
        amount: pucksEarned,
        balance: wallet.balance,
        description: `Won ${pick.predictedWinner} pick!`,
        pickId: pick.id,
      });
    } else {
      // Loss - pucks already deducted when locked
      pick.pucksEarned = 0;
      wallet.lifetimeLosses += pick.pucksWagered;
      wallet.totalLosses += 1;

      await logTransaction({
        type: 'pick_loss',
        amount: 0,
        balance: wallet.balance,
        description: `${pick.predictedWinner} lost to ${actualWinner}`,
        pickId: pick.id,
      });
    }

    // Save updates
    picks[pickIndex] = pick;
    await AsyncStorage.setItem(STORAGE_KEYS.LOCKED_PICKS, JSON.stringify(picks));
    await saveWallet(wallet);

    return { success: true, pucksEarned: pick.pucksEarned || 0, wallet };
  } catch (error) {
    console.error('[WALLET] Error resolving pick:', error);
    return { success: false, pucksEarned: 0 };
  }
};

// Log a transaction
const logTransaction = async (
  transaction: Omit<PuckTransaction, 'id' | 'timestamp'>
): Promise<void> => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.PUCK_HISTORY);
    const history: PuckTransaction[] = stored ? JSON.parse(stored) : [];

    const newTransaction: PuckTransaction = {
      ...transaction,
      id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };

    history.unshift(newTransaction);

    // Keep only last 100 transactions
    const trimmed = history.slice(0, 100);
    await AsyncStorage.setItem(STORAGE_KEYS.PUCK_HISTORY, JSON.stringify(trimmed));
  } catch (error) {
    console.error('[WALLET] Error logging transaction:', error);
  }
};

// Get transaction history
export const getTransactionHistory = async (): Promise<PuckTransaction[]> => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.PUCK_HISTORY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('[WALLET] Error loading transaction history:', error);
  }
  return [];
};

// Check if a game is already locked
export const isGameLocked = async (gameId: string): Promise<boolean> => {
  const todaysPicks = await getTodaysLockedPicks();
  return todaysPicks.some(p => p.gameId === gameId);
};

// Get pick for a specific game
export const getPickForGame = async (gameId: string): Promise<LockedPick | null> => {
  const todaysPicks = await getTodaysLockedPicks();
  return todaysPicks.find(p => p.gameId === gameId) || null;
};
