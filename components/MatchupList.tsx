import React from 'react';
import { Text, View } from 'react-native';
import { makeStyles } from '../constants/theme';
import { Skeleton } from './ui/SkeletonLoader';
import MatchupGameCard, { GamePrediction } from './MatchupGameCard';

export interface MatchupListGame {
  id: string | number;
  homeTeam?: {
    abbrev?: string;
    score?: number;
  };
  awayTeam?: {
    abbrev?: string;
    score?: number;
  };
  startTimeUTC?: string;
  venue?: { default?: string };
  gameState?: string;
  periodDescriptor?: {
    number?: number;
    periodType?: string;
  };
  clock?: {
    timeRemaining?: string;
    inIntermission?: boolean;
  };
}

interface MatchupListProps {
  /** Array of games to display */
  games: MatchupListGame[] | null;
  /** Loading state */
  loading: boolean;
  /** Currently selected team filter (abbreviation) */
  selectedTeam: string | null;
  /** Function to calculate win probability for a matchup */
  calculateWinProbability: (homeAbbrev: string, awayAbbrev: string) => GamePrediction;
  /** Function to get key factors for a matchup */
  getKeyFactors: (homeAbbrev: string, awayAbbrev: string, prediction: GamePrediction) => string[];
  /** Callback when a game card is pressed */
  onGamePress?: (game: MatchupListGame) => void;
}

/**
 * Displays a list of today's NHL matchups with predictions and live scores.
 * Handles loading, empty, and filtered states.
 */
export default function MatchupList({
  games,
  loading,
  selectedTeam,
  calculateWinProbability,
  getKeyFactors,
  onGamePress,
}: MatchupListProps) {
  const styles = makeStyles();

  console.log('[MatchupList] Rendering with:', {
    gamesCount: games?.length || 0,
    loading,
    selectedTeam
  });

  // Filter games by selected team
  const filteredGames = React.useMemo(() => {
    if (!games) return [];
    if (!selectedTeam) return games;

    return games.filter((g) => {
      const homeAbbrev = (g.homeTeam?.abbrev || '').toUpperCase();
      const awayAbbrev = (g.awayTeam?.abbrev || '').toUpperCase();
      return homeAbbrev === selectedTeam || awayAbbrev === selectedTeam;
    });
  }, [games, selectedTeam]);

  // Loading State
  if (loading) {
    return (
      <View style={[styles.card, { width: '100%', alignSelf: 'stretch' }]}>
        <Text style={[styles.greeting, { alignSelf: 'flex-start', marginBottom: 8 }]}>
          Today's Action
        </Text>
        <View style={{ marginTop: 0, width: '100%', padding: 16 }}>
          <Skeleton width="100%" height={60} borderRadius={12} style={{ marginBottom: 8 }} />
          <Skeleton width="100%" height={60} borderRadius={12} style={{ marginBottom: 8 }} />
          <Skeleton width="100%" height={60} borderRadius={12} />
        </View>
      </View>
    );
  }

  // Title based on filter
  const title = selectedTeam ? `${selectedTeam} Games Today` : "Today's Action";

  // No Games State (no games scheduled at all)
  if (!games || games.length === 0) {
    return (
      <View style={[styles.card, { width: '100%', alignSelf: 'stretch' }]}>
        <Text style={[styles.greeting, { alignSelf: 'flex-start', marginBottom: 8 }]}>
          {title}
        </Text>
        <View style={{ marginTop: 0, width: '100%' }}>
          <View style={{ backgroundColor: styles.factbox.backgroundColor, borderRadius: 12, padding: 16, marginBottom: 12 }}>
            <Text style={[styles.boxtitle, { marginBottom: 8, textAlign: 'center' }]}>
              No Games Today
            </Text>
            <Text style={[styles.subtextSmall, { lineHeight: 16, textAlign: 'center' }]}>
              No games scheduled today. Check back tomorrow for matchup predictions!
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // Filtered Empty State (team has no games today, but other games exist)
  if (selectedTeam && filteredGames.length === 0) {
    return (
      <View style={[styles.card, { width: '100%', alignSelf: 'stretch' }]}>
        <Text style={[styles.greeting, { alignSelf: 'flex-start', marginBottom: 8 }]}>
          {title}
        </Text>
        <View style={{ marginTop: 0, width: '100%' }}>
          <View style={{ backgroundColor: styles.factbox.backgroundColor, borderRadius: 12, padding: 16, marginBottom: 12 }}>
            <Text style={[styles.boxtitle, { marginBottom: 8, textAlign: 'center' }]}>
              No {selectedTeam} Games Today
            </Text>
            <Text style={[styles.subtextSmall, { lineHeight: 16, textAlign: 'center' }]}>
              {selectedTeam} isn't playing today. There are {games.length} other game{games.length !== 1 ? 's' : ''} scheduled.
            </Text>
          </View>

          <Text style={[styles.subtextSmall, { textAlign: 'center', fontStyle: 'italic', opacity: 0.8 }]}>
            Check the upcoming games section below for {selectedTeam}'s next game.
          </Text>
        </View>
      </View>
    );
  }

  // Games List
  return (
    <View style={[styles.card, { width: '100%', alignSelf: 'stretch' }]}>
      <Text style={[styles.greeting, { alignSelf: 'flex-start', marginBottom: 8 }]}>
        {title}
      </Text>

      <View style={{ marginTop: 0, width: '100%' }}>
        {filteredGames.map((game) => {
          const homeAbbrev = game.homeTeam?.abbrev || 'HOME';
          const awayAbbrev = game.awayTeam?.abbrev || 'AWAY';
          const prediction = calculateWinProbability(homeAbbrev, awayAbbrev);
          const keyFactors = getKeyFactors(homeAbbrev, awayAbbrev, prediction);

          return (
            <MatchupGameCard
              key={game.id}
              game={game}
              prediction={prediction}
              keyFactors={keyFactors}
              onPress={onGamePress ? () => onGamePress(game) : undefined}
            />
          );
        })}
      </View>
    </View>
  );
}
