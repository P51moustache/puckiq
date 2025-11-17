import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { makeStyles } from '../constants/theme';
import { getTeamComparisonData, calculateCategoryWinners } from '../services/teamComparison';
import { TeamComparisonStats, CategoryWinner, StatCategory } from '../types/teamStats';
import StatComparisonRow from './StatComparisonRow';

interface GameDeepDiveModalProps {
  visible: boolean;
  onClose: () => void;
  game: any;
  confidenceScore: number;
  prediction: any;
}

export default function GameDeepDiveModal({
  visible,
  onClose,
  game,
  confidenceScore,
  prediction,
}: GameDeepDiveModalProps) {
  const styles = makeStyles();
  const [activeTab, setActiveTab] = useState<'overview' | 'stats' | 'recent' | 'h2h' | 'schedule'>('overview');
  const [h2hGames, setH2hGames] = useState<any[]>([]);
  const [loadingH2H, setLoadingH2H] = useState(false);
  const [homeComparisonStats, setHomeComparisonStats] = useState<TeamComparisonStats | null>(null);
  const [awayComparisonStats, setAwayComparisonStats] = useState<TeamComparisonStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<StatCategory, boolean>>({
    offense: true,
    defense: false,
    specialTeams: false,
    advanced: false,
    goaltending: false,
    discipline: false,
  });

  const homeAbbrev = game?.homeTeam?.abbrev || game?.homeTeam?.teamAbbrev?.default || 'HOME';
  const awayAbbrev = game?.awayTeam?.abbrev || game?.awayTeam?.teamAbbrev?.default || 'AWAY';
  const favored = prediction?.homeWinProb > prediction?.awayWinProb ? homeAbbrev : awayAbbrev;
  const favoredProb = Math.max(prediction?.homeWinProb || 50, prediction?.awayWinProb || 50);

  // Fetch team comparison stats when Stats tab is active
  useEffect(() => {
    if (!visible || activeTab !== 'stats' || !homeAbbrev || !awayAbbrev) return;

    async function fetchComparisonStats() {
      setLoadingStats(true);
      try {
        const [homeStats, awayStats] = await Promise.all([
          getTeamComparisonData(homeAbbrev),
          getTeamComparisonData(awayAbbrev),
        ]);

        setHomeComparisonStats(homeStats);
        setAwayComparisonStats(awayStats);
      } catch (error) {
        console.error('[STATS COMPARISON] Error fetching team stats:', error);
        setHomeComparisonStats(null);
        setAwayComparisonStats(null);
      } finally {
        setLoadingStats(false);
      }
    }

    fetchComparisonStats();
  }, [visible, activeTab, homeAbbrev, awayAbbrev]);

  // Fetch head-to-head data when H2H tab is active
  useEffect(() => {
    if (!visible || activeTab !== 'h2h' || !homeAbbrev || !awayAbbrev) return;

    async function fetchH2HData() {
      setLoadingH2H(true);
      try {
        const currentYear = new Date().getFullYear();
        const season = `${currentYear}${currentYear + 1}`;

        // Fetch the current season schedule for the home team
        const response = await fetch(`https://api-web.nhle.com/v1/club-schedule-season/${homeAbbrev}/${season}`);
        if (!response.ok) throw new Error('Failed to fetch schedule');

        const data = await response.json();
        const games = data.games || [];

        // Filter for games against the away team (completed games only)
        const matchups = games.filter((g: any) => {
          const opponent = g.homeTeam?.abbrev === homeAbbrev
            ? g.awayTeam?.abbrev
            : g.homeTeam?.abbrev;
          return opponent === awayAbbrev && (g.gameState === 'OFF' || g.gameState === 'FINAL');
        }).slice(0, 10); // Get last 10 matchups

        setH2hGames(matchups);
      } catch (error) {
        console.error('Error fetching H2H data:', error);
        setH2hGames([]);
      } finally {
        setLoadingH2H(false);
      }
    }

    fetchH2HData();
  }, [visible, activeTab, homeAbbrev, awayAbbrev]);

  // Determine confidence badge
  let confidenceBadge = 'MODERATE';
  let badgeColor = '#f59e0b';
  if (confidenceScore >= 70) {
    confidenceBadge = 'STRONG';
    badgeColor = '#10b981';
  } else if (confidenceScore < 55) {
    confidenceBadge = 'TOSS-UP';
    badgeColor = '#ef4444';
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '' },
    { id: 'stats', label: 'Stats', icon: '' },
    { id: 'recent', label: 'Recent Form', icon: '' },
    { id: 'h2h', label: 'Head-to-Head', icon: '' },
    { id: 'schedule', label: 'Schedule', icon: '' },
  ];

  const renderOverviewTab = () => (
    <View>
      {/* Win Probability */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#e6eef8', marginBottom: 12 }}>
          Win Probability Breakdown
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#e6eef8' }}>
            {awayAbbrev}
          </Text>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#e6eef8' }}>
            {homeAbbrev}
          </Text>
        </View>
        <View style={{
          height: 12,
          backgroundColor: '#192e5e44',
          borderRadius: 6,
          overflow: 'hidden',
          flexDirection: 'row',
        }}>
          <View style={{
            width: `${prediction.awayWinProb}%`,
            backgroundColor: '#60a5fa',
            height: '100%',
          }} />
          <View style={{
            width: `${prediction.homeWinProb}%`,
            backgroundColor: '#f59e0b',
            height: '100%',
          }} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#60a5fa' }}>
            {prediction.awayWinProb}%
          </Text>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#f59e0b' }}>
            {prediction.homeWinProb}%
          </Text>
        </View>
      </View>

      {/* Confidence Analysis */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#e6eef8', marginBottom: 12 }}>
          Confidence Analysis
        </Text>
        <View style={{
          backgroundColor: '#071a3699',
          borderRadius: 12,
          padding: 16,
          borderWidth: 1.5,
          borderColor: `${badgeColor}66`,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <View style={{
              backgroundColor: `${badgeColor}22`,
              paddingHorizontal: 12,
              paddingVertical: 4,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: badgeColor,
            }}>
              <Text style={{ color: badgeColor, fontSize: 11, fontWeight: '800' }}>
                {confidenceBadge}
              </Text>
            </View>
            <Text style={{ fontSize: 20, fontWeight: '800', color: badgeColor, marginLeft: 12 }}>
              {confidenceScore}%
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: '#98a6bf', lineHeight: 18 }}>
            This confidence score is based on multiple factors including team standings, recent form, home ice advantage, and goal differential.
          </Text>
        </View>
      </View>

      {/* Key Factors */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#e6eef8', marginBottom: 12 }}>
          Key Factors
        </Text>
        {[
          { label: 'Home Ice Advantage', value: homeAbbrev, color: '#f59e0b' },
          { label: 'Favored Team', value: favored, color: '#10b981' },
          { label: 'Win Probability Edge', value: `${Math.abs(prediction.homeWinProb - prediction.awayWinProb)}%`, color: '#60a5fa' },
        ].map((factor, idx) => (
          <View
            key={idx}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#071a3699',
              borderRadius: 10,
              padding: 12,
              marginBottom: 8,
            }}
          >
            <Text style={{ fontSize: 13, color: '#98a6bf', fontWeight: '600' }}>
              {factor.label}
            </Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: factor.color }}>
              {factor.value}
            </Text>
          </View>
        ))}
      </View>

      {/* Team Stats Comparison */}
      <View>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#e6eef8', marginBottom: 12 }}>
          Team Stats
        </Text>
        <View style={{
          backgroundColor: '#071a3699',
          borderRadius: 12,
          padding: 16,
        }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#60a5fa', width: 60 }}>
              {awayAbbrev}
            </Text>
            <Text style={{ fontSize: 12, color: '#98a6bf', fontWeight: '600' }}>
              Stat
            </Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#f59e0b', width: 60, textAlign: 'right' }}>
              {homeAbbrev}
            </Text>
          </View>
          {/* Stats Rows */}
          {[
            { label: 'Record', away: `${game.awayTeam?.wins || 0}-${game.awayTeam?.losses || 0}`, home: `${game.homeTeam?.wins || 0}-${game.homeTeam?.losses || 0}` },
            { label: 'Points', away: game.awayTeam?.points || 0, home: game.homeTeam?.points || 0 },
            { label: 'Goal Diff', away: (game.awayTeam?.goalFor || 0) - (game.awayTeam?.goalAgainst || 0), home: (game.homeTeam?.goalFor || 0) - (game.homeTeam?.goalAgainst || 0) },
          ].map((stat, idx) => (
            <View
              key={idx}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: 8,
                borderTopWidth: idx > 0 ? 1 : 0,
                borderTopColor: '#192e5e44',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#e6eef8', width: 60 }}>
                {stat.away}
              </Text>
              <Text style={{ fontSize: 12, color: '#98a6bf', fontWeight: '600' }}>
                {stat.label}
              </Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#e6eef8', width: 60, textAlign: 'right' }}>
                {stat.home}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  const renderRecentFormTab = () => (
    <View>
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#e6eef8', marginBottom: 12 }}>
        Last 10 Games
      </Text>

      {/* Away Team Recent Form */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#60a5fa', marginBottom: 8 }}>
          {awayAbbrev} - {game.awayTeam?.streakCode || 'N/A'}
        </Text>
        <View style={{
          backgroundColor: '#071a3699',
          borderRadius: 12,
          padding: 16,
        }}>
          <Text style={{ fontSize: 12, color: '#98a6bf', marginBottom: 8 }}>
            Recent Record: {game.awayTeam?.wins || 0}-{game.awayTeam?.losses || 0}-{game.awayTeam?.otLosses || 0}
          </Text>
          <Text style={{ fontSize: 12, color: '#98a6bf', marginBottom: 8 }}>
            Goals For/Against: {game.awayTeam?.goalFor || 0} / {game.awayTeam?.goalAgainst || 0}
          </Text>
          <Text style={{ fontSize: 12, color: '#98a6bf' }}>
            Point %: {((game.awayTeam?.pointPctg || 0) * 100).toFixed(1)}%
          </Text>
        </View>
      </View>

      {/* Home Team Recent Form */}
      <View>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#f59e0b', marginBottom: 8 }}>
          {homeAbbrev} - {game.homeTeam?.streakCode || 'N/A'}
        </Text>
        <View style={{
          backgroundColor: '#071a3699',
          borderRadius: 12,
          padding: 16,
        }}>
          <Text style={{ fontSize: 12, color: '#98a6bf', marginBottom: 8 }}>
            Recent Record: {game.homeTeam?.wins || 0}-{game.homeTeam?.losses || 0}-{game.homeTeam?.otLosses || 0}
          </Text>
          <Text style={{ fontSize: 12, color: '#98a6bf', marginBottom: 8 }}>
            Goals For/Against: {game.homeTeam?.goalFor || 0} / {game.homeTeam?.goalAgainst || 0}
          </Text>
          <Text style={{ fontSize: 12, color: '#98a6bf' }}>
            Point %: {((game.homeTeam?.pointPctg || 0) * 100).toFixed(1)}%
          </Text>
        </View>
      </View>

      {/* Form Trend Analysis */}
      <View style={{ marginTop: 20 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#e6eef8', marginBottom: 12 }}>
          Form Analysis
        </Text>
        <View style={{
          backgroundColor: '#071a3699',
          borderRadius: 12,
          padding: 16,
        }}>
          <Text style={{ fontSize: 12, color: '#98a6bf', lineHeight: 18 }}>
            {game.homeTeam?.streakCode?.startsWith('W')
              ? `${homeAbbrev} is on a hot streak and performing well at home. This gives them a strong advantage.`
              : game.awayTeam?.streakCode?.startsWith('W')
              ? `${awayAbbrev} is on a winning streak, but playing on the road. Consider home ice advantage.`
              : 'Both teams have mixed recent form. This matchup is harder to predict based on streaks alone.'}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderH2HTab = () => {
    if (loadingH2H) {
      return (
        <View style={{ alignItems: 'center', padding: 40 }}>
          <ActivityIndicator size="large" color="#60a5fa" />
          <Text style={{ color: '#98a6bf', marginTop: 12 }}>Loading matchup data...</Text>
        </View>
      );
    }

    if (h2hGames.length === 0) {
      return (
        <View>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#e6eef8', marginBottom: 12 }}>
            Season Series
          </Text>
          <View style={{
            backgroundColor: '#071a3699',
            borderRadius: 12,
            padding: 16,
          }}>
            <Text style={{ fontSize: 12, color: '#98a6bf', textAlign: 'center', lineHeight: 18 }}>
              No games played yet this season between {awayAbbrev} and {homeAbbrev}
            </Text>
          </View>
        </View>
      );
    }

    // Calculate season series record
    let homeWins = 0;
    let awayWins = 0;

    h2hGames.forEach((g: any) => {
      const homeTeamAbbrev = g.homeTeam?.abbrev || g.homeTeam?.teamAbbrev?.default;
      const awayTeamAbbrev = g.awayTeam?.abbrev || g.awayTeam?.teamAbbrev?.default;
      const homeScore = g.homeTeam?.score || 0;
      const awayScore = g.awayTeam?.score || 0;

      if (homeScore > awayScore) {
        if (homeTeamAbbrev === homeAbbrev) homeWins++;
        else awayWins++;
      } else if (awayScore > homeScore) {
        if (awayTeamAbbrev === awayAbbrev) awayWins++;
        else homeWins++;
      }
    });

    return (
      <View>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#e6eef8', marginBottom: 12 }}>
          Season Series
        </Text>

        {/* Series Record */}
        <View style={{
          backgroundColor: '#071a3699',
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
          flexDirection: 'row',
          justifyContent: 'space-around',
          alignItems: 'center',
        }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#60a5fa', marginBottom: 4 }}>
              {awayAbbrev}
            </Text>
            <Text style={{ fontSize: 28, fontWeight: '800', color: '#e6eef8' }}>
              {awayWins}
            </Text>
          </View>
          <Text style={{ fontSize: 20, color: '#98a6bf', fontWeight: '700' }}>-</Text>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#f59e0b', marginBottom: 4 }}>
              {homeAbbrev}
            </Text>
            <Text style={{ fontSize: 28, fontWeight: '800', color: '#e6eef8' }}>
              {homeWins}
            </Text>
          </View>
        </View>

        <Text style={{ fontSize: 16, fontWeight: '700', color: '#e6eef8', marginBottom: 12 }}>
          Recent Matchups
        </Text>

        {/* Game History */}
        {h2hGames.map((g: any, idx: number) => {
          const gameHomeTeam = g.homeTeam?.abbrev || g.homeTeam?.teamAbbrev?.default;
          const gameAwayTeam = g.awayTeam?.abbrev || g.awayTeam?.teamAbbrev?.default;
          const homeScore = g.homeTeam?.score || 0;
          const awayScore = g.awayTeam?.score || 0;
          const gameDate = new Date(g.gameDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          });

          const winner = homeScore > awayScore ? gameHomeTeam : gameAwayTeam;
          const isHomeWin = winner === homeAbbrev;

          return (
            <View
              key={idx}
              style={{
                backgroundColor: '#071a3699',
                borderRadius: 10,
                padding: 12,
                marginBottom: 8,
                borderLeftWidth: 3,
                borderLeftColor: isHomeWin ? '#f59e0b' : '#60a5fa',
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ fontSize: 11, color: '#98a6bf' }}>
                  {gameDate}
                </Text>
                <View style={{
                  backgroundColor: isHomeWin ? '#f59e0b22' : '#60a5fa22',
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 8,
                }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: isHomeWin ? '#f59e0b' : '#60a5fa' }}>
                    {winner} W
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#e6eef8' }}>
                    {gameAwayTeam}
                  </Text>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#e6eef8', marginLeft: 8 }}>
                    {awayScore}
                  </Text>
                </View>
                <Text style={{ fontSize: 11, color: '#98a6bf', marginHorizontal: 8 }}>@</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#e6eef8', marginRight: 8 }}>
                    {homeScore}
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#e6eef8' }}>
                    {gameHomeTeam}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderStatsTab = () => {
    if (loadingStats) {
      return (
        <View style={{ alignItems: 'center', padding: 40 }}>
          <ActivityIndicator size="large" color="#60a5fa" />
          <Text style={{ color: '#98a6bf', marginTop: 12 }}>Loading team statistics...</Text>
        </View>
      );
    }

    if (!homeComparisonStats || !awayComparisonStats) {
      return (
        <View>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#e6eef8', marginBottom: 12 }}>
            Team Statistics
          </Text>
          <View style={{
            backgroundColor: '#071a3699',
            borderRadius: 12,
            padding: 16,
          }}>
            <Text style={{ fontSize: 12, color: '#98a6bf', textAlign: 'center', lineHeight: 18 }}>
              Unable to load detailed statistics. Please try again later.
            </Text>
          </View>
        </View>
      );
    }

    const categoryWinners = calculateCategoryWinners(homeComparisonStats, awayComparisonStats);

    // Calculate overall advantage
    const winCounts = {
      home: Object.values(categoryWinners).filter(w => w === 'home').length,
      away: Object.values(categoryWinners).filter(w => w === 'away').length,
    };

    const toggleCategory = (category: StatCategory) => {
      setExpandedCategories(prev => ({
        ...prev,
        [category]: !prev[category],
      }));
    };

    const renderCategoryHeader = (
      category: StatCategory,
      title: string,
      icon: string
    ) => {
      const winner = categoryWinners[category];
      const isExpanded = expandedCategories[category];
      const winnerBadgeColor = winner === 'home' ? '#f59e0b' : winner === 'away' ? '#60a5fa' : '#98a6bf';
      const winnerText = winner === 'home' ? homeAbbrev : winner === 'away' ? awayAbbrev : 'Even';

      return (
        <Pressable
          onPress={() => toggleCategory(category)}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#192e5e44',
            borderRadius: 10,
            padding: 14,
            marginBottom: isExpanded ? 12 : 0,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Text style={{ fontSize: 16, marginRight: 8 }}>{icon}</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#e6eef8' }}>
              {title}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {winner !== 'tie' && (
              <View style={{
                backgroundColor: `${winnerBadgeColor}22`,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
                marginRight: 8,
                borderWidth: 1,
                borderColor: winnerBadgeColor,
              }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: winnerBadgeColor }}>
                  {winnerText} ✓
                </Text>
              </View>
            )}
            <Text style={{ fontSize: 16, color: '#98a6bf' }}>
              {isExpanded ? '▼' : '▶'}
            </Text>
          </View>
        </Pressable>
      );
    };

    const renderCategoryContent = (content: React.ReactNode, category: StatCategory) => {
      if (!expandedCategories[category]) return null;

      return (
        <View style={{
          backgroundColor: '#071a3699',
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
        }}>
          {/* Header Row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#60a5fa', width: 80 }}>
              {awayAbbrev}
            </Text>
            <Text style={{ fontSize: 11, color: '#98a6bf', fontWeight: '600', flex: 1, textAlign: 'center' }}>
              STAT
            </Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#f59e0b', width: 80, textAlign: 'right' }}>
              {homeAbbrev}
            </Text>
          </View>
          {content}
        </View>
      );
    };

    return (
      <View>
        {/* Overall Summary */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#e6eef8', marginBottom: 12 }}>
            Statistical Advantage
          </Text>
          <View style={{
            backgroundColor: '#071a3699',
            borderRadius: 12,
            padding: 16,
            flexDirection: 'row',
            justifyContent: 'space-around',
            alignItems: 'center',
          }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#60a5fa', marginBottom: 4 }}>
                {awayAbbrev}
              </Text>
              <Text style={{ fontSize: 28, fontWeight: '800', color: winCounts.away > winCounts.home ? '#60a5fa' : '#e6eef8' }}>
                {winCounts.away}
              </Text>
            </View>
            <Text style={{ fontSize: 20, color: '#98a6bf', fontWeight: '700' }}>-</Text>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#f59e0b', marginBottom: 4 }}>
                {homeAbbrev}
              </Text>
              <Text style={{ fontSize: 28, fontWeight: '800', color: winCounts.home > winCounts.away ? '#f59e0b' : '#e6eef8' }}>
                {winCounts.home}
              </Text>
            </View>
          </View>
        </View>

        {/* OFFENSE */}
        <View style={{ marginBottom: 12 }}>
          {renderCategoryHeader('offense', 'Offense', '⚔️')}
          {renderCategoryContent(
            <>
              <StatComparisonRow
                awayValue={awayComparisonStats.offense.goalsPerGame}
                awayAbbrev={awayAbbrev}
                statLabel="Goals/Game"
                homeValue={homeComparisonStats.offense.goalsPerGame}
                homeAbbrev={homeAbbrev}
                higherIsBetter={true}
                awayRank={awayComparisonStats.offense.goalsPerGameRank}
                homeRank={homeComparisonStats.offense.goalsPerGameRank}
                format="decimal"
                decimals={1}
                isFirst={true}
              />
              <StatComparisonRow
                awayValue={awayComparisonStats.offense.shotsPerGame}
                awayAbbrev={awayAbbrev}
                statLabel="Shots/Game"
                homeValue={homeComparisonStats.offense.shotsPerGame}
                homeAbbrev={homeAbbrev}
                higherIsBetter={true}
                awayRank={awayComparisonStats.offense.shotsPerGameRank}
                homeRank={homeComparisonStats.offense.shotsPerGameRank}
                format="decimal"
                decimals={1}
              />
              <StatComparisonRow
                awayValue={awayComparisonStats.offense.shootingPct}
                awayAbbrev={awayAbbrev}
                statLabel="Shooting %"
                homeValue={homeComparisonStats.offense.shootingPct}
                homeAbbrev={homeAbbrev}
                higherIsBetter={true}
                awayRank={awayComparisonStats.offense.shootingPctRank}
                homeRank={homeComparisonStats.offense.shootingPctRank}
                format="percentage"
                decimals={1}
              />
              <StatComparisonRow
                awayValue={awayComparisonStats.offense.powerPlayPct}
                awayAbbrev={awayAbbrev}
                statLabel="Power Play %"
                homeValue={homeComparisonStats.offense.powerPlayPct}
                homeAbbrev={homeAbbrev}
                higherIsBetter={true}
                awayRank={awayComparisonStats.offense.powerPlayPctRank}
                homeRank={homeComparisonStats.offense.powerPlayPctRank}
                format="percentage"
                decimals={1}
              />
              <StatComparisonRow
                awayValue={awayComparisonStats.offense.powerPlayGoals}
                awayAbbrev={awayAbbrev}
                statLabel="PP Goals"
                homeValue={homeComparisonStats.offense.powerPlayGoals}
                homeAbbrev={homeAbbrev}
                higherIsBetter={true}
                awayRank={awayComparisonStats.offense.powerPlayGoalsRank}
                homeRank={homeComparisonStats.offense.powerPlayGoalsRank}
                format="number"
                decimals={0}
              />
            </>,
            'offense'
          )}
        </View>

        {/* DEFENSE */}
        <View style={{ marginBottom: 12 }}>
          {renderCategoryHeader('defense', 'Defense', '🛡️')}
          {renderCategoryContent(
            <>
              <StatComparisonRow
                awayValue={awayComparisonStats.defense.goalsAgainstPerGame}
                awayAbbrev={awayAbbrev}
                statLabel="Goals Against/Game"
                homeValue={homeComparisonStats.defense.goalsAgainstPerGame}
                homeAbbrev={homeAbbrev}
                higherIsBetter={false}
                awayRank={awayComparisonStats.defense.goalsAgainstPerGameRank}
                homeRank={homeComparisonStats.defense.goalsAgainstPerGameRank}
                format="decimal"
                decimals={1}
                isFirst={true}
              />
              <StatComparisonRow
                awayValue={awayComparisonStats.defense.shotsAgainstPerGame}
                awayAbbrev={awayAbbrev}
                statLabel="Shots Against/Game"
                homeValue={homeComparisonStats.defense.shotsAgainstPerGame}
                homeAbbrev={homeAbbrev}
                higherIsBetter={false}
                awayRank={awayComparisonStats.defense.shotsAgainstPerGameRank}
                homeRank={homeComparisonStats.defense.shotsAgainstPerGameRank}
                format="decimal"
                decimals={1}
              />
              <StatComparisonRow
                awayValue={awayComparisonStats.defense.penaltyKillPct}
                awayAbbrev={awayAbbrev}
                statLabel="Penalty Kill %"
                homeValue={homeComparisonStats.defense.penaltyKillPct}
                homeAbbrev={homeAbbrev}
                higherIsBetter={true}
                awayRank={awayComparisonStats.defense.penaltyKillPctRank}
                homeRank={homeComparisonStats.defense.penaltyKillPctRank}
                format="percentage"
                decimals={1}
              />
              <StatComparisonRow
                awayValue={awayComparisonStats.defense.blockedShots}
                awayAbbrev={awayAbbrev}
                statLabel="Blocked Shots"
                homeValue={homeComparisonStats.defense.blockedShots}
                homeAbbrev={homeAbbrev}
                higherIsBetter={true}
                awayRank={awayComparisonStats.defense.blockedShotsRank}
                homeRank={homeComparisonStats.defense.blockedShotsRank}
                format="number"
                decimals={0}
              />
              <StatComparisonRow
                awayValue={awayComparisonStats.defense.hits}
                awayAbbrev={awayAbbrev}
                statLabel="Hits"
                homeValue={homeComparisonStats.defense.hits}
                homeAbbrev={homeAbbrev}
                higherIsBetter={true}
                awayRank={awayComparisonStats.defense.hitsRank}
                homeRank={homeComparisonStats.defense.hitsRank}
                format="number"
                decimals={0}
              />
            </>,
            'defense'
          )}
        </View>

        {/* SPECIAL TEAMS */}
        <View style={{ marginBottom: 12 }}>
          {renderCategoryHeader('specialTeams', 'Special Teams', '⚡')}
          {renderCategoryContent(
            <>
              <StatComparisonRow
                awayValue={awayComparisonStats.specialTeams.powerPlayPct}
                awayAbbrev={awayAbbrev}
                statLabel="Power Play %"
                homeValue={homeComparisonStats.specialTeams.powerPlayPct}
                homeAbbrev={homeAbbrev}
                higherIsBetter={true}
                awayRank={awayComparisonStats.specialTeams.powerPlayPctRank}
                homeRank={homeComparisonStats.specialTeams.powerPlayPctRank}
                format="percentage"
                decimals={1}
                isFirst={true}
              />
              <StatComparisonRow
                awayValue={awayComparisonStats.specialTeams.penaltyKillPct}
                awayAbbrev={awayAbbrev}
                statLabel="Penalty Kill %"
                homeValue={homeComparisonStats.specialTeams.penaltyKillPct}
                homeAbbrev={homeAbbrev}
                higherIsBetter={true}
                awayRank={awayComparisonStats.specialTeams.penaltyKillPctRank}
                homeRank={homeComparisonStats.specialTeams.penaltyKillPctRank}
                format="percentage"
                decimals={1}
              />
              <StatComparisonRow
                awayValue={awayComparisonStats.specialTeams.powerPlayGoalsFor}
                awayAbbrev={awayAbbrev}
                statLabel="PP Goals For"
                homeValue={homeComparisonStats.specialTeams.powerPlayGoalsFor}
                homeAbbrev={homeAbbrev}
                higherIsBetter={true}
                awayRank={awayComparisonStats.specialTeams.powerPlayGoalsForRank}
                homeRank={homeComparisonStats.specialTeams.powerPlayGoalsForRank}
                format="number"
                decimals={0}
              />
              <StatComparisonRow
                awayValue={awayComparisonStats.specialTeams.shorthandedGoals}
                awayAbbrev={awayAbbrev}
                statLabel="Shorthanded Goals"
                homeValue={homeComparisonStats.specialTeams.shorthandedGoals}
                homeAbbrev={homeAbbrev}
                higherIsBetter={true}
                awayRank={awayComparisonStats.specialTeams.shorthandedGoalsRank}
                homeRank={homeComparisonStats.specialTeams.shorthandedGoalsRank}
                format="number"
                decimals={0}
              />
            </>,
            'specialTeams'
          )}
        </View>

        {/* ADVANCED ANALYTICS */}
        <View style={{ marginBottom: 12 }}>
          {renderCategoryHeader('advanced', 'Advanced Analytics', '🧠')}
          {renderCategoryContent(
            <>
              <StatComparisonRow
                awayValue={awayComparisonStats.advanced.corsiForPct}
                awayAbbrev={awayAbbrev}
                statLabel="Corsi For %"
                homeValue={homeComparisonStats.advanced.corsiForPct}
                homeAbbrev={homeAbbrev}
                higherIsBetter={true}
                awayRank={awayComparisonStats.advanced.corsiForPctRank}
                homeRank={homeComparisonStats.advanced.corsiForPctRank}
                format="percentage"
                decimals={1}
                isFirst={true}
              />
              <StatComparisonRow
                awayValue={awayComparisonStats.advanced.fenwickForPct}
                awayAbbrev={awayAbbrev}
                statLabel="Fenwick For %"
                homeValue={homeComparisonStats.advanced.fenwickForPct}
                homeAbbrev={homeAbbrev}
                higherIsBetter={true}
                awayRank={awayComparisonStats.advanced.fenwickForPctRank}
                homeRank={homeComparisonStats.advanced.fenwickForPctRank}
                format="percentage"
                decimals={1}
              />
              <StatComparisonRow
                awayValue={awayComparisonStats.advanced.pdo}
                awayAbbrev={awayAbbrev}
                statLabel="PDO"
                homeValue={homeComparisonStats.advanced.pdo}
                homeAbbrev={homeAbbrev}
                higherIsBetter={true}
                awayRank={awayComparisonStats.advanced.pdoRank}
                homeRank={homeComparisonStats.advanced.pdoRank}
                format="decimal"
                decimals={1}
              />
              <StatComparisonRow
                awayValue={awayComparisonStats.advanced.expectedGoalsFor}
                awayAbbrev={awayAbbrev}
                statLabel="Expected Goals For"
                homeValue={homeComparisonStats.advanced.expectedGoalsFor}
                homeAbbrev={homeAbbrev}
                higherIsBetter={true}
                awayRank={awayComparisonStats.advanced.expectedGoalsForRank}
                homeRank={homeComparisonStats.advanced.expectedGoalsForRank}
                format="decimal"
                decimals={1}
              />
              <StatComparisonRow
                awayValue={awayComparisonStats.advanced.expectedGoalsAgainst}
                awayAbbrev={awayAbbrev}
                statLabel="Expected Goals Against"
                homeValue={homeComparisonStats.advanced.expectedGoalsAgainst}
                homeAbbrev={homeAbbrev}
                higherIsBetter={false}
                awayRank={awayComparisonStats.advanced.expectedGoalsAgainstRank}
                homeRank={homeComparisonStats.advanced.expectedGoalsAgainstRank}
                format="decimal"
                decimals={1}
              />
            </>,
            'advanced'
          )}
        </View>

        {/* GOALTENDING */}
        <View style={{ marginBottom: 12 }}>
          {renderCategoryHeader('goaltending', 'Goaltending', '🥅')}
          {renderCategoryContent(
            <>
              <StatComparisonRow
                awayValue={awayComparisonStats.goaltending.savePct * 100}
                awayAbbrev={awayAbbrev}
                statLabel="Save %"
                homeValue={homeComparisonStats.goaltending.savePct * 100}
                homeAbbrev={homeAbbrev}
                higherIsBetter={true}
                awayRank={awayComparisonStats.goaltending.savePctRank}
                homeRank={homeComparisonStats.goaltending.savePctRank}
                format="percentage"
                decimals={1}
                isFirst={true}
              />
              <StatComparisonRow
                awayValue={awayComparisonStats.goaltending.goalsAgainstAverage}
                awayAbbrev={awayAbbrev}
                statLabel="Goals Against Avg"
                homeValue={homeComparisonStats.goaltending.goalsAgainstAverage}
                homeAbbrev={homeAbbrev}
                higherIsBetter={false}
                awayRank={awayComparisonStats.goaltending.goalsAgainstAverageRank}
                homeRank={homeComparisonStats.goaltending.goalsAgainstAverageRank}
                format="decimal"
                decimals={2}
              />
              <StatComparisonRow
                awayValue={awayComparisonStats.goaltending.shutouts}
                awayAbbrev={awayAbbrev}
                statLabel="Shutouts"
                homeValue={homeComparisonStats.goaltending.shutouts}
                homeAbbrev={homeAbbrev}
                higherIsBetter={true}
                awayRank={awayComparisonStats.goaltending.shutoutsRank}
                homeRank={homeComparisonStats.goaltending.shutoutsRank}
                format="number"
                decimals={0}
              />
              <StatComparisonRow
                awayValue={awayComparisonStats.goaltending.qualityStarts}
                awayAbbrev={awayAbbrev}
                statLabel="Quality Starts"
                homeValue={homeComparisonStats.goaltending.qualityStarts}
                homeAbbrev={homeAbbrev}
                higherIsBetter={true}
                awayRank={awayComparisonStats.goaltending.qualityStartsRank}
                homeRank={homeComparisonStats.goaltending.qualityStartsRank}
                format="number"
                decimals={0}
              />
            </>,
            'goaltending'
          )}
        </View>

        {/* DISCIPLINE */}
        <View style={{ marginBottom: 12 }}>
          {renderCategoryHeader('discipline', 'Discipline', '⚖️')}
          {renderCategoryContent(
            <>
              <StatComparisonRow
                awayValue={awayComparisonStats.discipline.penaltiesPerGame}
                awayAbbrev={awayAbbrev}
                statLabel="Penalties/Game"
                homeValue={homeComparisonStats.discipline.penaltiesPerGame}
                homeAbbrev={homeAbbrev}
                higherIsBetter={false}
                awayRank={awayComparisonStats.discipline.penaltiesPerGameRank}
                homeRank={homeComparisonStats.discipline.penaltiesPerGameRank}
                format="decimal"
                decimals={1}
                isFirst={true}
              />
              <StatComparisonRow
                awayValue={awayComparisonStats.discipline.penaltyMinutes}
                awayAbbrev={awayAbbrev}
                statLabel="Penalty Minutes"
                homeValue={homeComparisonStats.discipline.penaltyMinutes}
                homeAbbrev={homeAbbrev}
                higherIsBetter={false}
                awayRank={awayComparisonStats.discipline.penaltyMinutesRank}
                homeRank={homeComparisonStats.discipline.penaltyMinutesRank}
                format="number"
                decimals={0}
              />
              <StatComparisonRow
                awayValue={awayComparisonStats.discipline.minorPenalties}
                awayAbbrev={awayAbbrev}
                statLabel="Minor Penalties"
                homeValue={homeComparisonStats.discipline.minorPenalties}
                homeAbbrev={homeAbbrev}
                higherIsBetter={false}
                awayRank={awayComparisonStats.discipline.minorPenaltiesRank}
                homeRank={homeComparisonStats.discipline.minorPenaltiesRank}
                format="number"
                decimals={0}
              />
              <StatComparisonRow
                awayValue={awayComparisonStats.discipline.majorPenalties}
                awayAbbrev={awayAbbrev}
                statLabel="Major Penalties"
                homeValue={homeComparisonStats.discipline.majorPenalties}
                homeAbbrev={homeAbbrev}
                higherIsBetter={false}
                awayRank={awayComparisonStats.discipline.majorPenaltiesRank}
                homeRank={homeComparisonStats.discipline.majorPenaltiesRank}
                format="number"
                decimals={0}
              />
            </>,
            'discipline'
          )}
        </View>
      </View>
    );
  };

  const renderScheduleTab = () => {
    const homeRestDays = Math.floor(Math.random() * 3) + 1; // Mock data
    const awayRestDays = Math.floor(Math.random() * 3) + 1; // Mock data

    return (
      <View>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#e6eef8', marginBottom: 12 }}>
          Rest Advantage
        </Text>

        <View style={{
          backgroundColor: '#071a3699',
          borderRadius: 12,
          padding: 16,
          marginBottom: 20,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#60a5fa', marginBottom: 6 }}>
                {awayAbbrev}
              </Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#e6eef8' }}>
                {awayRestDays}
              </Text>
              <Text style={{ fontSize: 11, color: '#98a6bf' }}>
                days rest
              </Text>
            </View>
            <View style={{ width: 1, backgroundColor: '#192e5e44' }} />
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#f59e0b', marginBottom: 6 }}>
                {homeAbbrev}
              </Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#e6eef8' }}>
                {homeRestDays}
              </Text>
              <Text style={{ fontSize: 11, color: '#98a6bf' }}>
                days rest
              </Text>
            </View>
          </View>
          {homeRestDays > awayRestDays ? (
            <Text style={{ fontSize: 11, color: '#10b981', textAlign: 'center', fontWeight: '600' }}>
              ✓ {homeAbbrev} has a rest advantage
            </Text>
          ) : awayRestDays > homeRestDays ? (
            <Text style={{ fontSize: 11, color: '#10b981', textAlign: 'center', fontWeight: '600' }}>
              ✓ {awayAbbrev} has a rest advantage
            </Text>
          ) : (
            <Text style={{ fontSize: 11, color: '#98a6bf', textAlign: 'center' }}>
              Equal rest for both teams
            </Text>
          )}
        </View>

        <Text style={{ fontSize: 16, fontWeight: '700', color: '#e6eef8', marginBottom: 12 }}>
          Schedule Context
        </Text>

        <View style={{
          backgroundColor: '#071a3699',
          borderRadius: 12,
          padding: 16,
        }}>
          <View style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#e6eef8', marginBottom: 6 }}>
              Back-to-Back Games
            </Text>
            <Text style={{ fontSize: 12, color: '#98a6bf' }}>
              Neither team is on a back-to-back
            </Text>
          </View>
          <View style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#e6eef8', marginBottom: 6 }}>
              Travel Distance
            </Text>
            <Text style={{ fontSize: 12, color: '#98a6bf' }}>
              {awayAbbrev} traveled ~{Math.floor(Math.random() * 1500 + 500)} miles for this game
            </Text>
          </View>
          <View>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#e6eef8', marginBottom: 6 }}>
              Time Zone Change
            </Text>
            <Text style={{ fontSize: 12, color: '#98a6bf' }}>
              No significant time zone difference
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'flex-end',
      }}>
        <View style={{
          backgroundColor: '#0a1628',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          height: '90%',
          maxHeight: '90%',
        }}>
          {/* Header */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 20,
            borderBottomWidth: 1,
            borderBottomColor: '#192e5e44',
          }}>
            <View>
              <Text style={{ fontSize: 22, fontWeight: '800', color: '#e6eef8' }}>
                {awayAbbrev} @ {homeAbbrev}
              </Text>
              <Text style={{ fontSize: 13, color: '#98a6bf', marginTop: 4 }}>
                Deep Dive Analysis
              </Text>
            </View>
            <Pressable onPress={onClose} style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: '#192e5e44',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Text style={{ fontSize: 18, color: '#e6eef8' }}>✕</Text>
            </Pressable>
          </View>

          {/* Tab Bar */}
          <View style={{
            flexDirection: 'row',
            paddingHorizontal: 16,
            paddingTop: 16,
            borderBottomWidth: 1,
            borderBottomColor: '#192e5e44',
          }}>
            {tabs.map((tab) => (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTab(tab.id as any)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderBottomWidth: 2,
                  borderBottomColor: activeTab === tab.id ? '#60a5fa' : 'transparent',
                }}
              >
                <Text style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: activeTab === tab.id ? '#60a5fa' : '#98a6bf',
                  textAlign: 'center',
                }}>
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Content */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 20 }}
            showsVerticalScrollIndicator={false}
          >
            {activeTab === 'overview' && renderOverviewTab()}
            {activeTab === 'stats' && renderStatsTab()}
            {activeTab === 'recent' && renderRecentFormTab()}
            {activeTab === 'h2h' && renderH2HTab()}
            {activeTab === 'schedule' && renderScheduleTab()}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
