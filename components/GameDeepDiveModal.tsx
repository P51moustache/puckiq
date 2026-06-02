import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAccessibleTextColor } from '../constants/teamColors';
import { getTeamComparisonData, calculateCategoryWinners } from '../services/teamComparison';
import { TeamComparisonStats, StatCategory } from '../types/teamStats';
import StatComparisonRow from './StatComparisonRow';
import { getH2HRecord , fetchGameResults } from '../services/gameResults';
import { getKeyPlayersForGame } from '../services/playerStats';
import type { H2HRecord, TeamPlayerStats } from '../types/gameResults';
import { fetchTeamEdge } from '../services/edgeStats';
import { calculateMomentum, calculateClutchRating } from '../services/derivedStats';
import MomentumSparkline from './MomentumSparkline';
import ClutchBadge from './ClutchBadge';
import ZoneTimeChart from './ZoneTimeChart';
import SpeedGauge from './SpeedGauge';
import type { TeamEdgeDetail, MomentumData, ClutchRating as ClutchRatingType } from '../types/edgeStats';
import type { NHLGameSummary } from '../types/predictions';

interface EnhancedPrediction {
  homeWinProb: number;
  awayWinProb: number;
  goalieAdvantage?: 'home' | 'away' | 'neutral';
  hotPlayersImpact?: number;
  playerFactorsApplied?: boolean;
}

interface GameDeepDiveModalProps {
  visible: boolean;
  onClose: () => void;
  game: NHLGameSummary;
  prediction: EnhancedPrediction;
  restMap?: Map<string, number>;
}

export default function GameDeepDiveModal({
  visible,
  onClose,
  game,
  prediction,
  restMap,
}: GameDeepDiveModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'stats' | 'recent' | 'h2h' | 'players' | 'edge' | 'schedule'>('overview');
  const [h2hRecord, setH2hRecord] = useState<H2HRecord | null>(null);
  const [loadingH2H, setLoadingH2H] = useState(false);
  const [homePlayerStats, setHomePlayerStats] = useState<TeamPlayerStats | null>(null);
  const [awayPlayerStats, setAwayPlayerStats] = useState<TeamPlayerStats | null>(null);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
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
  const [showGoalieInfo, setShowGoalieInfo] = useState(false);
  const [showHotPlayersInfo, setShowHotPlayersInfo] = useState(false);
  const [showHomeIceInfo, setShowHomeIceInfo] = useState(false);
  const [showFavoredInfo, setShowFavoredInfo] = useState(false);
  const [showEdgeInfo, setShowEdgeInfo] = useState(false);
  const [homeEdgeDetail, setHomeEdgeDetail] = useState<TeamEdgeDetail | null>(null);
  const [awayEdgeDetail, setAwayEdgeDetail] = useState<TeamEdgeDetail | null>(null);
  const [homeMomentum, setHomeMomentum] = useState<MomentumData | null>(null);
  const [awayMomentum, setAwayMomentum] = useState<MomentumData | null>(null);
  const [homeClutch, setHomeClutch] = useState<ClutchRatingType | null>(null);
  const [awayClutch, setAwayClutch] = useState<ClutchRatingType | null>(null);
  const [loadingEdge, setLoadingEdge] = useState(false);

  const homeAbbrev = game?.homeTeam?.abbrev || 'HOME';
  const awayAbbrev = game?.awayTeam?.abbrev || 'AWAY';
  const homeTeamId: number | undefined = game?.homeTeam?.id;
  const awayTeamId: number | undefined = game?.awayTeam?.id;
  const favored = prediction?.homeWinProb > prediction?.awayWinProb ? homeAbbrev : awayAbbrev;
  const homeTeamColor = getAccessibleTextColor(homeAbbrev);
  const awayTeamColor = getAccessibleTextColor(awayAbbrev);
  const favoredColor = getAccessibleTextColor(favored);

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

  // Fetch head-to-head data when H2H tab is active (from Supabase)
  useEffect(() => {
    if (!visible || activeTab !== 'h2h' || !homeAbbrev || !awayAbbrev) return;

    async function fetchH2HData() {
      setLoadingH2H(true);
      try {
        const record = await getH2HRecord(awayAbbrev, homeAbbrev);
        setH2hRecord(record);
      } catch (error) {
        console.error('[H2H] Error fetching H2H data:', error);
        setH2hRecord(null);
      } finally {
        setLoadingH2H(false);
      }
    }

    fetchH2HData();
  }, [visible, activeTab, homeAbbrev, awayAbbrev]);

  // Fetch key players when Players tab is active
  useEffect(() => {
    if (!visible || activeTab !== 'players' || !homeAbbrev || !awayAbbrev) return;

    async function fetchPlayerStats() {
      setLoadingPlayers(true);
      try {
        const { home, away } = await getKeyPlayersForGame(homeAbbrev, awayAbbrev);
        setHomePlayerStats(home);
        setAwayPlayerStats(away);
      } catch (error) {
        console.error('[PLAYER STATS] Error fetching player stats:', error);
        setHomePlayerStats(null);
        setAwayPlayerStats(null);
      } finally {
        setLoadingPlayers(false);
      }
    }

    fetchPlayerStats();
  }, [visible, activeTab, homeAbbrev, awayAbbrev]);

  // Fetch Edge IQ data when Edge tab is active
  useEffect(() => {
    if (!visible || activeTab !== 'edge' || !homeAbbrev || !awayAbbrev) return;
    if (!homeTeamId || !awayTeamId) return; // Need team IDs for Edge API
    if (homeEdgeDetail || awayEdgeDetail) return; // Already fetched

    async function fetchEdgeData() {
      setLoadingEdge(true);
      try {
        const [homeEdge, awayEdge, gameResults] = await Promise.all([
          fetchTeamEdge(homeTeamId!),
          fetchTeamEdge(awayTeamId!),
          fetchGameResults(),
        ]);

        setHomeEdgeDetail(homeEdge);
        setAwayEdgeDetail(awayEdge);

        if (gameResults.length > 0) {
          setHomeMomentum(calculateMomentum(homeAbbrev, gameResults));
          setAwayMomentum(calculateMomentum(awayAbbrev, gameResults));
          setHomeClutch(calculateClutchRating(homeAbbrev, gameResults));
          setAwayClutch(calculateClutchRating(awayAbbrev, gameResults));
        }
      } catch (error) {
        console.error('[EDGE IQ] Error fetching edge data:', error);
      } finally {
        setLoadingEdge(false);
      }
    }

    fetchEdgeData();
  }, [visible, activeTab, homeAbbrev, awayAbbrev, homeTeamId, awayTeamId, homeEdgeDetail, awayEdgeDetail]);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '' },
    // { id: 'stats', label: 'Stats', icon: '' }, // Disabled temporarily
    { id: 'recent', label: 'Recent Form', icon: '' },
    { id: 'h2h', label: 'Head-to-Head', icon: '' },
    { id: 'players', label: 'Key Players', icon: '' },
    { id: 'edge', label: 'Edge IQ', icon: '' },
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
          <Text style={{ fontSize: 13, fontWeight: '600', color: awayTeamColor }}>
            {awayAbbrev}
          </Text>
          <Text style={{ fontSize: 13, fontWeight: '600', color: homeTeamColor }}>
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
            width: `${prediction?.awayWinProb || 50}%`,
            backgroundColor: awayTeamColor,
            height: '100%',
          }} />
          <View style={{
            width: `${prediction?.homeWinProb || 50}%`,
            backgroundColor: homeTeamColor,
            height: '100%',
          }} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: awayTeamColor }}>
            {prediction?.awayWinProb || 50}%
          </Text>
          <Text style={{ fontSize: 14, fontWeight: '700', color: homeTeamColor }}>
            {prediction?.homeWinProb || 50}%
          </Text>
        </View>
      </View>

      {/* Key Factors */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#e6eef8', marginBottom: 12 }}>
          Key Factors
        </Text>

        {/* Home Ice Advantage */}
        <Pressable
          onPress={() => setShowHomeIceInfo(true)}
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
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: '#98a6bf', fontWeight: '600' }}>
              Home Ice Advantage
            </Text>
            <View style={{
              marginLeft: 6,
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: '#192e5e',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Text style={{ fontSize: 10, color: '#60a5fa', fontWeight: '700' }}>?</Text>
            </View>
          </View>
          <Text style={{ fontSize: 14, fontWeight: '700', color: homeTeamColor }}>
            {homeAbbrev}
          </Text>
        </Pressable>

        {/* Favored Team */}
        <Pressable
          onPress={() => setShowFavoredInfo(true)}
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
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: '#98a6bf', fontWeight: '600' }}>
              Favored Team
            </Text>
            <View style={{
              marginLeft: 6,
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: '#192e5e',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Text style={{ fontSize: 10, color: '#60a5fa', fontWeight: '700' }}>?</Text>
            </View>
          </View>
          <Text style={{ fontSize: 14, fontWeight: '700', color: favoredColor }}>
            {favored}
          </Text>
        </Pressable>

        {/* Win Probability Edge */}
        <Pressable
          onPress={() => setShowEdgeInfo(true)}
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
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: '#98a6bf', fontWeight: '600' }}>
              Win Probability Edge
            </Text>
            <View style={{
              marginLeft: 6,
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: '#192e5e',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Text style={{ fontSize: 10, color: '#60a5fa', fontWeight: '700' }}>?</Text>
            </View>
          </View>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#60a5fa' }}>
            {Math.abs((prediction?.homeWinProb || 50) - (prediction?.awayWinProb || 50))}%
          </Text>
        </Pressable>
      </View>

      {/* Player Advantage (when player factors are applied) */}
      {prediction.playerFactorsApplied === true && (
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#e6eef8', marginBottom: 12 }}>
            Player Factors
          </Text>
          <View style={{
            backgroundColor: '#071a3699',
            borderRadius: 12,
            padding: 16,
          }}>
            {/* Goalie Matchup */}
            {prediction.goalieAdvantage && (
              <Pressable
                onPress={() => setShowGoalieInfo(true)}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: (prediction.hotPlayersImpact ?? 0) !== 0 ? 12 : 0,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="hand-left-outline" size={16} color="#98a6bf" style={{ marginRight: 8 }} />
                  <Text style={{ fontSize: 13, color: '#98a6bf', fontWeight: '600' }}>
                    Goalie Advantage
                  </Text>
                  <View style={{
                    marginLeft: 6,
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: '#192e5e',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                    <Text style={{ fontSize: 10, color: '#60a5fa', fontWeight: '700' }}>?</Text>
                  </View>
                </View>
                <View style={{
                  backgroundColor: prediction.goalieAdvantage === 'home' ? `${homeTeamColor}22` :
                                 prediction.goalieAdvantage === 'away' ? `${awayTeamColor}22` : '#98a6bf22',
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 8,
                }}>
                  <Text style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: prediction.goalieAdvantage === 'home' ? homeTeamColor :
                           prediction.goalieAdvantage === 'away' ? awayTeamColor : '#98a6bf',
                  }}>
                    {prediction.goalieAdvantage === 'home' ? homeAbbrev :
                     prediction.goalieAdvantage === 'away' ? awayAbbrev : 'Even'}
                  </Text>
                </View>
              </Pressable>
            )}

            {/* Hot Players Impact */}
            {(prediction.hotPlayersImpact ?? 0) !== 0 && (
              <Pressable
                onPress={() => setShowHotPlayersInfo(true)}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: 12,
                  borderTopWidth: 1,
                  borderTopColor: '#192e5e44',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="flame-outline" size={16} color="#98a6bf" style={{ marginRight: 8 }} />
                  <Text style={{ fontSize: 13, color: '#98a6bf', fontWeight: '600' }}>
                    Hot Players Edge
                  </Text>
                  <View style={{
                    marginLeft: 6,
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: '#192e5e',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                    <Text style={{ fontSize: 10, color: '#60a5fa', fontWeight: '700' }}>?</Text>
                  </View>
                </View>
                <View style={{
                  backgroundColor: (prediction.hotPlayersImpact ?? 0) > 0 ? `${homeTeamColor}22` : `${awayTeamColor}22`,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 8,
                }}>
                  <Text style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: (prediction.hotPlayersImpact ?? 0) > 0 ? homeTeamColor : awayTeamColor,
                  }}>
                    +{Math.round(Math.abs((prediction.hotPlayersImpact ?? 0) / 1.5))} {(prediction.hotPlayersImpact ?? 0) > 0 ? homeAbbrev : awayAbbrev}
                  </Text>
                </View>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* Goalie Advantage Info Popup */}
      <Modal
        visible={showGoalieInfo}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowGoalieInfo(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}
          onPress={() => setShowGoalieInfo(false)}
        >
          <View style={{
            backgroundColor: '#0a1628',
            borderRadius: 16,
            padding: 20,
            maxWidth: 340,
            borderWidth: 1,
            borderColor: '#192e5e',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Ionicons name="hand-left-outline" size={24} color="#98a6bf" style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#e6eef8' }}>
                Goalie Advantage
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: '#98a6bf', lineHeight: 22, marginBottom: 12 }}>
              Compares the expected starting goalies based on:
            </Text>
            <View style={{ marginBottom: 12 }}>
              {[
                'Season save percentage (SV%)',
                'Goals against average (GAA)',
                'Recent performance (last 5 games)',
                'Games started this season',
              ].map((item, idx) => (
                <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 }}>
                  <Text style={{ color: '#60a5fa', marginRight: 8, fontSize: 12 }}>•</Text>
                  <Text style={{ fontSize: 13, color: '#c9d4e8', flex: 1 }}>{item}</Text>
                </View>
              ))}
            </View>
            <View style={{
              backgroundColor: '#071a3699',
              borderRadius: 10,
              padding: 12,
              marginBottom: 16,
            }}>
              <Text style={{ fontSize: 12, color: '#98a6bf', lineHeight: 18 }}>
                The team shown has the goaltending advantage for this matchup. A strong goalie can significantly impact the outcome.
              </Text>
            </View>
            <Pressable
              onPress={() => setShowGoalieInfo(false)}
              style={{
                backgroundColor: '#60a5fa',
                borderRadius: 10,
                paddingVertical: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#0a1628' }}>Got it</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Hot Players Info Popup */}
      <Modal
        visible={showHotPlayersInfo}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowHotPlayersInfo(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}
          onPress={() => setShowHotPlayersInfo(false)}
        >
          <View style={{
            backgroundColor: '#0a1628',
            borderRadius: 16,
            padding: 20,
            maxWidth: 340,
            borderWidth: 1,
            borderColor: '#192e5e',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Ionicons name="flame-outline" size={24} color="#98a6bf" style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#e6eef8' }}>
                Hot Players Edge
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: '#98a6bf', lineHeight: 22, marginBottom: 12 }}>
              Measures the difference in player momentum between teams:
            </Text>
            <View style={{ marginBottom: 12 }}>
              {[
                'Players on scoring streaks (+1 each)',
                'Players in cold slumps (-1 each)',
                'Difference creates the "edge" value',
              ].map((item, idx) => (
                <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 }}>
                  <Text style={{ color: '#f59e0b', marginRight: 8, fontSize: 12 }}>•</Text>
                  <Text style={{ fontSize: 13, color: '#c9d4e8', flex: 1 }}>{item}</Text>
                </View>
              ))}
            </View>
            <View style={{
              backgroundColor: '#071a3699',
              borderRadius: 10,
              padding: 12,
              marginBottom: 16,
            }}>
              <Text style={{ fontSize: 12, color: '#98a6bf', lineHeight: 18 }}>
                <Text style={{ color: '#10b981', fontWeight: '600' }}>+2 TOR</Text> means Toronto has a net advantage of 2 more hot/fewer cold players than their opponent.{'\n\n'}
                Example: TOR has 3 hot, 1 cold (+2) vs opponent with 1 hot, 1 cold (0) = +2 edge for TOR.
              </Text>
            </View>
            <Pressable
              onPress={() => setShowHotPlayersInfo(false)}
              style={{
                backgroundColor: '#f59e0b',
                borderRadius: 10,
                paddingVertical: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#0a1628' }}>Got it</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Home Ice Advantage Info Popup */}
      <Modal
        visible={showHomeIceInfo}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowHomeIceInfo(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}
          onPress={() => setShowHomeIceInfo(false)}
        >
          <View style={{
            backgroundColor: '#0a1628',
            borderRadius: 16,
            padding: 20,
            maxWidth: 340,
            borderWidth: 1,
            borderColor: '#192e5e',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Ionicons name="home-outline" size={24} color="#98a6bf" style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#e6eef8' }}>
                Home Ice Advantage
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: '#98a6bf', lineHeight: 22, marginBottom: 12 }}>
              The team playing on their home ice has a statistical advantage:
            </Text>
            <View style={{ marginBottom: 12 }}>
              {[
                'Home teams win ~54% of NHL games historically',
                'Last line change gives tactical advantage',
                'Familiar arena and ice conditions',
                'Crowd energy and support',
              ].map((item, idx) => (
                <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 }}>
                  <Text style={{ color: '#f59e0b', marginRight: 8, fontSize: 12 }}>•</Text>
                  <Text style={{ fontSize: 13, color: '#c9d4e8', flex: 1 }}>{item}</Text>
                </View>
              ))}
            </View>
            <View style={{
              backgroundColor: '#071a3699',
              borderRadius: 10,
              padding: 12,
              marginBottom: 16,
            }}>
              <Text style={{ fontSize: 12, color: '#98a6bf', lineHeight: 18 }}>
                This factor adds approximately <Text style={{ color: '#f59e0b', fontWeight: '600' }}>+4%</Text> to the home team's base win probability in our prediction model.
              </Text>
            </View>
            <Pressable
              onPress={() => setShowHomeIceInfo(false)}
              style={{
                backgroundColor: '#f59e0b',
                borderRadius: 10,
                paddingVertical: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#0a1628' }}>Got it</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Favored Team Info Popup */}
      <Modal
        visible={showFavoredInfo}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowFavoredInfo(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}
          onPress={() => setShowFavoredInfo(false)}
        >
          <View style={{
            backgroundColor: '#0a1628',
            borderRadius: 16,
            padding: 20,
            maxWidth: 340,
            borderWidth: 1,
            borderColor: '#192e5e',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Ionicons name="star" size={24} color="#fbbf24" style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#e6eef8' }}>
                Favored Team
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: '#98a6bf', lineHeight: 22, marginBottom: 12 }}>
              The team with the higher win probability based on:
            </Text>
            <View style={{ marginBottom: 12 }}>
              {[
                'Points percentage this season',
                'Goal differential',
                'Recent form and streaks',
                'Home ice advantage',
                'Goalie matchup quality',
                'Hot/cold player momentum',
              ].map((item, idx) => (
                <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 }}>
                  <Text style={{ color: '#10b981', marginRight: 8, fontSize: 12 }}>•</Text>
                  <Text style={{ fontSize: 13, color: '#c9d4e8', flex: 1 }}>{item}</Text>
                </View>
              ))}
            </View>
            <View style={{
              backgroundColor: '#071a3699',
              borderRadius: 10,
              padding: 12,
              marginBottom: 16,
            }}>
              <Text style={{ fontSize: 12, color: '#98a6bf', lineHeight: 18 }}>
                All these factors are combined and weighted to calculate each team's win probability. The team above <Text style={{ color: '#10b981', fontWeight: '600' }}>50%</Text> is favored to win.
              </Text>
            </View>
            <Pressable
              onPress={() => setShowFavoredInfo(false)}
              style={{
                backgroundColor: '#10b981',
                borderRadius: 10,
                paddingVertical: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#0a1628' }}>Got it</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Win Probability Edge Info Popup */}
      <Modal
        visible={showEdgeInfo}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowEdgeInfo(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}
          onPress={() => setShowEdgeInfo(false)}
        >
          <View style={{
            backgroundColor: '#0a1628',
            borderRadius: 16,
            padding: 20,
            maxWidth: 340,
            borderWidth: 1,
            borderColor: '#192e5e',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Ionicons name="stats-chart-outline" size={24} color="#98a6bf" style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#e6eef8' }}>
                Win Probability Edge
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: '#98a6bf', lineHeight: 22, marginBottom: 12 }}>
              The difference between the two teams' win probabilities:
            </Text>
            <View style={{ marginBottom: 12 }}>
              {[
                'Higher edge = more confident prediction',
                'Lower edge = closer, less certain matchup',
                'Range is typically 0-70%',
              ].map((item, idx) => (
                <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 }}>
                  <Text style={{ color: '#60a5fa', marginRight: 8, fontSize: 12 }}>•</Text>
                  <Text style={{ fontSize: 13, color: '#c9d4e8', flex: 1 }}>{item}</Text>
                </View>
              ))}
            </View>
            <View style={{
              backgroundColor: '#071a3699',
              borderRadius: 10,
              padding: 12,
              marginBottom: 16,
            }}>
              <Text style={{ fontSize: 12, color: '#98a6bf', lineHeight: 18 }}>
                <Text style={{ color: '#60a5fa', fontWeight: '600' }}>Example:</Text> If Team A has 65% and Team B has 35%, the edge is <Text style={{ color: '#60a5fa', fontWeight: '600' }}>30%</Text>. A larger edge means our model is more confident in the predicted winner.
              </Text>
            </View>
            <Pressable
              onPress={() => setShowEdgeInfo(false)}
              style={{
                backgroundColor: '#60a5fa',
                borderRadius: 10,
                paddingVertical: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#0a1628' }}>Got it</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

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
            <Text style={{ fontSize: 13, fontWeight: '700', color: awayTeamColor, width: 60 }}>
              {awayAbbrev}
            </Text>
            <Text style={{ fontSize: 12, color: '#98a6bf', fontWeight: '600' }}>
              Stat
            </Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: homeTeamColor, width: 60, textAlign: 'right' }}>
              {homeAbbrev}
            </Text>
          </View>
          {/* Stats Rows */}
          {[
            { label: 'Score', away: game.awayTeam?.score ?? '-', home: game.homeTeam?.score ?? '-' },
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
        <Text style={{ fontSize: 14, fontWeight: '600', color: awayTeamColor, marginBottom: 8 }}>
          {awayAbbrev} {game.awayTeam?.streakCode ? `- ${game.awayTeam.streakCode}` : ''}
        </Text>
        <View style={{
          backgroundColor: '#071a3699',
          borderRadius: 12,
          padding: 16,
        }}>
          <Text style={{ fontSize: 12, color: '#98a6bf', textAlign: 'center' }}>
            Recent form data available in Stats and H2H tabs
          </Text>
        </View>
      </View>

      {/* Home Team Recent Form */}
      <View>
        <Text style={{ fontSize: 14, fontWeight: '600', color: homeTeamColor, marginBottom: 8 }}>
          {homeAbbrev} {game.homeTeam?.streakCode ? `- ${game.homeTeam.streakCode}` : ''}
        </Text>
        <View style={{
          backgroundColor: '#071a3699',
          borderRadius: 12,
          padding: 16,
        }}>
          <Text style={{ fontSize: 12, color: '#98a6bf', textAlign: 'center' }}>
            Recent form data available in Stats and H2H tabs
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

    if (!h2hRecord || h2hRecord.games.length === 0) {
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
            <Text style={{ fontSize: 13, fontWeight: '600', color: awayTeamColor, marginBottom: 4 }}>
              {awayAbbrev}
            </Text>
            <Text style={{ fontSize: 28, fontWeight: '800', color: '#e6eef8' }}>
              {h2hRecord.teamAWins}
            </Text>
          </View>
          <Text style={{ fontSize: 20, color: '#98a6bf', fontWeight: '700' }}>-</Text>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: homeTeamColor, marginBottom: 4 }}>
              {homeAbbrev}
            </Text>
            <Text style={{ fontSize: 28, fontWeight: '800', color: '#e6eef8' }}>
              {h2hRecord.teamBWins}
            </Text>
          </View>
        </View>

        <Text style={{ fontSize: 16, fontWeight: '700', color: '#e6eef8', marginBottom: 12 }}>
          Recent Matchups
        </Text>

        {/* Game History from Supabase */}
        {h2hRecord.games.map((g, idx) => {
          const winner = g.home_score > g.away_score ? g.home_team_abbrev : g.away_team_abbrev;
          const isHomeWin = winner === homeAbbrev;
          const gameDate = new Date(g.game_date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });

          return (
            <View
              key={g.id}
              style={{
                backgroundColor: '#071a3699',
                borderRadius: 10,
                padding: 12,
                marginBottom: 8,
                borderLeftWidth: 3,
                borderLeftColor: isHomeWin ? homeTeamColor : awayTeamColor,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ fontSize: 11, color: '#98a6bf' }}>
                  {gameDate}
                </Text>
                <View style={{
                  backgroundColor: isHomeWin ? `${homeTeamColor}22` : `${awayTeamColor}22`,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 8,
                }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: isHomeWin ? homeTeamColor : awayTeamColor }}>
                    {winner} W
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#e6eef8' }}>
                    {g.away_team_abbrev}
                  </Text>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#e6eef8', marginLeft: 8 }}>
                    {g.away_score}
                  </Text>
                </View>
                <Text style={{ fontSize: 11, color: '#98a6bf', marginHorizontal: 8 }}>@</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#e6eef8', marginRight: 8 }}>
                    {g.home_score}
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#e6eef8' }}>
                    {g.home_team_abbrev}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderPlayersTab = () => {
    if (loadingPlayers) {
      return (
        <View style={{ alignItems: 'center', padding: 40 }}>
          <ActivityIndicator size="large" color="#60a5fa" />
          <Text style={{ color: '#98a6bf', marginTop: 12 }}>Loading player stats...</Text>
        </View>
      );
    }

    const renderTeamSkaters = (teamAbbrev: string, stats: TeamPlayerStats | null, color: string) => {
      const skaters = stats?.skaters?.slice(0, 5) ?? [];
      if (skaters.length === 0) {
        return (
          <View style={{ backgroundColor: '#071a3699', borderRadius: 12, padding: 16 }}>
            <Text style={{ fontSize: 12, color: '#98a6bf', textAlign: 'center' }}>
              No player data available
            </Text>
          </View>
        );
      }

      return (
        <View style={{ backgroundColor: '#071a3699', borderRadius: 12, padding: 16 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#192e5e44' }}>
            <Text style={{ flex: 1, fontSize: 10, fontWeight: '700', color: '#98a6bf' }}>PLAYER</Text>
            <Text style={{ width: 30, fontSize: 10, fontWeight: '700', color: '#98a6bf', textAlign: 'center' }}>GP</Text>
            <Text style={{ width: 25, fontSize: 10, fontWeight: '700', color: '#98a6bf', textAlign: 'center' }}>G</Text>
            <Text style={{ width: 25, fontSize: 10, fontWeight: '700', color: '#98a6bf', textAlign: 'center' }}>A</Text>
            <Text style={{ width: 30, fontSize: 10, fontWeight: '700', color: '#98a6bf', textAlign: 'center' }}>PTS</Text>
            <Text style={{ width: 30, fontSize: 10, fontWeight: '700', color: '#98a6bf', textAlign: 'center' }}>+/-</Text>
          </View>
          {skaters.map((player, idx) => (
            <View
              key={player.playerId}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 6,
                borderBottomWidth: idx < skaters.length - 1 ? 1 : 0,
                borderBottomColor: '#192e5e22',
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#e6eef8' }}>
                  {player.firstName[0]}. {player.lastName}
                </Text>
                <Text style={{ fontSize: 9, color: '#98a6bf' }}>{player.positionCode}</Text>
              </View>
              <Text style={{ width: 30, fontSize: 11, color: '#98a6bf', textAlign: 'center' }}>{player.gamesPlayed}</Text>
              <Text style={{ width: 25, fontSize: 11, color: '#e6eef8', fontWeight: '600', textAlign: 'center' }}>{player.goals}</Text>
              <Text style={{ width: 25, fontSize: 11, color: '#e6eef8', fontWeight: '600', textAlign: 'center' }}>{player.assists}</Text>
              <Text style={{ width: 30, fontSize: 11, color: color, fontWeight: '700', textAlign: 'center' }}>{player.points}</Text>
              <Text style={{
                width: 30,
                fontSize: 11,
                fontWeight: '600',
                textAlign: 'center',
                color: player.plusMinus > 0 ? '#10b981' : player.plusMinus < 0 ? '#ef4444' : '#98a6bf',
              }}>
                {player.plusMinus > 0 ? '+' : ''}{player.plusMinus}
              </Text>
            </View>
          ))}
        </View>
      );
    };

    const renderTeamGoalies = (stats: TeamPlayerStats | null, color: string) => {
      const goalies = stats?.goalies?.slice(0, 2) ?? [];
      if (goalies.length === 0) return null;

      return (
        <View style={{ backgroundColor: '#071a3699', borderRadius: 12, padding: 16, marginTop: 8 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#192e5e44' }}>
            <Text style={{ flex: 1, fontSize: 10, fontWeight: '700', color: '#98a6bf' }}>GOALIE</Text>
            <Text style={{ width: 30, fontSize: 10, fontWeight: '700', color: '#98a6bf', textAlign: 'center' }}>GP</Text>
            <Text style={{ width: 30, fontSize: 10, fontWeight: '700', color: '#98a6bf', textAlign: 'center' }}>W</Text>
            <Text style={{ width: 30, fontSize: 10, fontWeight: '700', color: '#98a6bf', textAlign: 'center' }}>L</Text>
            <Text style={{ width: 35, fontSize: 10, fontWeight: '700', color: '#98a6bf', textAlign: 'center' }}>GAA</Text>
            <Text style={{ width: 40, fontSize: 10, fontWeight: '700', color: '#98a6bf', textAlign: 'center' }}>SV%</Text>
          </View>
          {goalies.map((goalie, idx) => (
            <View
              key={goalie.playerId}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 6,
                borderBottomWidth: idx < goalies.length - 1 ? 1 : 0,
                borderBottomColor: '#192e5e22',
              }}
            >
              <Text style={{ flex: 1, fontSize: 12, fontWeight: '600', color: '#e6eef8' }}>
                {goalie.firstName[0]}. {goalie.lastName}
              </Text>
              <Text style={{ width: 30, fontSize: 11, color: '#98a6bf', textAlign: 'center' }}>{goalie.gamesPlayed}</Text>
              <Text style={{ width: 30, fontSize: 11, color: '#10b981', fontWeight: '600', textAlign: 'center' }}>{goalie.wins}</Text>
              <Text style={{ width: 30, fontSize: 11, color: '#ef4444', fontWeight: '600', textAlign: 'center' }}>{goalie.losses}</Text>
              <Text style={{ width: 35, fontSize: 11, color: '#e6eef8', fontWeight: '600', textAlign: 'center' }}>{goalie.goalsAgainstAvg.toFixed(2)}</Text>
              <Text style={{ width: 40, fontSize: 11, color: color, fontWeight: '700', textAlign: 'center' }}>{(goalie.savePctg * 100).toFixed(1)}%</Text>
            </View>
          ))}
        </View>
      );
    };

    return (
      <View>
        {/* Away Team */}
        <Text style={{ fontSize: 14, fontWeight: '600', color: awayTeamColor, marginBottom: 8 }}>
          {awayAbbrev} - Top Skaters
        </Text>
        {renderTeamSkaters(awayAbbrev, awayPlayerStats, awayTeamColor)}
        {renderTeamGoalies(awayPlayerStats, awayTeamColor)}

        {/* Home Team */}
        <Text style={{ fontSize: 14, fontWeight: '600', color: homeTeamColor, marginTop: 20, marginBottom: 8 }}>
          {homeAbbrev} - Top Skaters
        </Text>
        {renderTeamSkaters(homeAbbrev, homePlayerStats, homeTeamColor)}
        {renderTeamGoalies(homePlayerStats, homeTeamColor)}
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
      iconName: keyof typeof Ionicons.glyphMap
    ) => {
      const winner = categoryWinners[category];
      const isExpanded = expandedCategories[category];
      const winnerBadgeColor = winner === 'home' ? homeTeamColor : winner === 'away' ? awayTeamColor : '#98a6bf';
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
            <Ionicons name={iconName} size={16} color="#98a6bf" style={{ marginRight: 8 }} />
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
            <Text style={{ fontSize: 12, fontWeight: '700', color: awayTeamColor, width: 80 }}>
              {awayAbbrev}
            </Text>
            <Text style={{ fontSize: 11, color: '#98a6bf', fontWeight: '600', flex: 1, textAlign: 'center' }}>
              STAT
            </Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: homeTeamColor, width: 80, textAlign: 'right' }}>
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
              <Text style={{ fontSize: 12, fontWeight: '600', color: awayTeamColor, marginBottom: 4 }}>
                {awayAbbrev}
              </Text>
              <Text style={{ fontSize: 28, fontWeight: '800', color: winCounts.away > winCounts.home ? awayTeamColor : '#e6eef8' }}>
                {winCounts.away}
              </Text>
            </View>
            <Text style={{ fontSize: 20, color: '#98a6bf', fontWeight: '700' }}>-</Text>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: homeTeamColor, marginBottom: 4 }}>
                {homeAbbrev}
              </Text>
              <Text style={{ fontSize: 28, fontWeight: '800', color: winCounts.home > winCounts.away ? homeTeamColor : '#e6eef8' }}>
                {winCounts.home}
              </Text>
            </View>
          </View>
        </View>

        {/* OFFENSE */}
        <View style={{ marginBottom: 12 }}>
          {renderCategoryHeader('offense', 'Offense', 'flash-outline')}
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
                decimals={2}
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
            </>,
            'offense'
          )}
        </View>

        {/* DEFENSE */}
        <View style={{ marginBottom: 12 }}>
          {renderCategoryHeader('defense', 'Defense', 'shield-outline')}
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
                decimals={2}
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
            </>,
            'defense'
          )}
        </View>

        {/* SPECIAL TEAMS */}
        <View style={{ marginBottom: 12 }}>
          {renderCategoryHeader('specialTeams', 'Special Teams', 'flash')}
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
                statLabel="PP Goals"
                homeValue={homeComparisonStats.specialTeams.powerPlayGoalsFor}
                homeAbbrev={homeAbbrev}
                higherIsBetter={true}
                awayRank={awayComparisonStats.specialTeams.powerPlayGoalsForRank}
                homeRank={homeComparisonStats.specialTeams.powerPlayGoalsForRank}
                format="number"
                decimals={0}
              />
            </>,
            'specialTeams'
          )}
        </View>

        {/* GOALTENDING */}
        <View style={{ marginBottom: 12 }}>
          {renderCategoryHeader('goaltending', 'Goaltending', 'hand-left-outline')}
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
                statLabel="GAA"
                homeValue={homeComparisonStats.goaltending.goalsAgainstAverage}
                homeAbbrev={homeAbbrev}
                higherIsBetter={false}
                awayRank={awayComparisonStats.goaltending.goalsAgainstAverageRank}
                homeRank={homeComparisonStats.goaltending.goalsAgainstAverageRank}
                format="decimal"
                decimals={2}
              />
            </>,
            'goaltending'
          )}
        </View>

        {/* Note: Advanced and Discipline categories are hidden because the NHL API doesn't provide this data */}

      </View>
    );
  };

  const renderEdgeTab = () => {
    if (loadingEdge) {
      return (
        <View style={{ alignItems: 'center', padding: 40 }}>
          <ActivityIndicator size="large" color="#60a5fa" />
          <Text style={{ color: '#98a6bf', marginTop: 12 }}>Loading Edge IQ data...</Text>
        </View>
      );
    }

    if (!homeEdgeDetail && !awayEdgeDetail) {
      return (
        <View style={{
          backgroundColor: '#071a3699',
          borderRadius: 12,
          padding: 16,
        }}>
          <Text style={{ fontSize: 12, color: '#98a6bf', textAlign: 'center', lineHeight: 18 }}>
            Edge IQ data not available for this matchup yet. Check back closer to game time.
          </Text>
        </View>
      );
    }

    return (
      <View>
        {/* Shot Speed Comparison */}
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#e6eef8', marginBottom: 12 }}>
          Shot Speed
        </Text>
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: awayTeamColor, marginBottom: 8, textAlign: 'center' }}>
              {awayAbbrev}
            </Text>
            {awayEdgeDetail?.shotSpeed?.topShotSpeed ? (
              <SpeedGauge
                value={awayEdgeDetail.shotSpeed.topShotSpeed.imperial}
                label="Top Shot"
                unit="mph"
                percentile={awayEdgeDetail.shotSpeed.topShotSpeed.percentile}
                leagueAvg={awayEdgeDetail.shotSpeed.topShotSpeed.leagueAvg?.imperial}
              />
            ) : (
              <View style={{ backgroundColor: '#071a3699', borderRadius: 10, padding: 12, alignItems: 'center' }}>
                <Text style={{ fontSize: 11, color: '#98a6bf' }}>No data</Text>
              </View>
            )}
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: homeTeamColor, marginBottom: 8, textAlign: 'center' }}>
              {homeAbbrev}
            </Text>
            {homeEdgeDetail?.shotSpeed?.topShotSpeed ? (
              <SpeedGauge
                value={homeEdgeDetail.shotSpeed.topShotSpeed.imperial}
                label="Top Shot"
                unit="mph"
                percentile={homeEdgeDetail.shotSpeed.topShotSpeed.percentile}
                leagueAvg={homeEdgeDetail.shotSpeed.topShotSpeed.leagueAvg?.imperial}
              />
            ) : (
              <View style={{ backgroundColor: '#071a3699', borderRadius: 10, padding: 12, alignItems: 'center' }}>
                <Text style={{ fontSize: 11, color: '#98a6bf' }}>No data</Text>
              </View>
            )}
          </View>
        </View>

        {/* Skating Speed Comparison */}
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#e6eef8', marginBottom: 12 }}>
          Skating Speed
        </Text>
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}>
          <View style={{ flex: 1, marginRight: 8 }}>
            {awayEdgeDetail?.skatingSpeed?.speedMax ? (
              <SpeedGauge
                value={awayEdgeDetail.skatingSpeed.speedMax.imperial}
                label="Top Speed"
                unit="mph"
                percentile={awayEdgeDetail.skatingSpeed.speedMax.percentile}
                leagueAvg={awayEdgeDetail.skatingSpeed.speedMax.leagueAvg?.imperial}
              />
            ) : (
              <View style={{ backgroundColor: '#071a3699', borderRadius: 10, padding: 12, alignItems: 'center' }}>
                <Text style={{ fontSize: 11, color: '#98a6bf' }}>No data</Text>
              </View>
            )}
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            {homeEdgeDetail?.skatingSpeed?.speedMax ? (
              <SpeedGauge
                value={homeEdgeDetail.skatingSpeed.speedMax.imperial}
                label="Top Speed"
                unit="mph"
                percentile={homeEdgeDetail.skatingSpeed.speedMax.percentile}
                leagueAvg={homeEdgeDetail.skatingSpeed.speedMax.leagueAvg?.imperial}
              />
            ) : (
              <View style={{ backgroundColor: '#071a3699', borderRadius: 10, padding: 12, alignItems: 'center' }}>
                <Text style={{ fontSize: 11, color: '#98a6bf' }}>No data</Text>
              </View>
            )}
          </View>
        </View>

        {/* Zone Time Comparison */}
        {(homeEdgeDetail?.zoneTimeDetails || awayEdgeDetail?.zoneTimeDetails) && (
          <>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#e6eef8', marginBottom: 12 }}>
              Zone Time
            </Text>
            <View style={{ marginBottom: 20 }}>
              {awayEdgeDetail?.zoneTimeDetails && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: awayTeamColor, marginBottom: 6 }}>
                    {awayAbbrev}
                  </Text>
                  <ZoneTimeChart
                    offPctg={awayEdgeDetail.zoneTimeDetails.offensiveZonePctg}
                    neutPctg={awayEdgeDetail.zoneTimeDetails.neutralZonePctg}
                    defPctg={awayEdgeDetail.zoneTimeDetails.defensiveZonePctg}
                  />
                </View>
              )}
              {homeEdgeDetail?.zoneTimeDetails && (
                <View>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: homeTeamColor, marginBottom: 6 }}>
                    {homeAbbrev}
                  </Text>
                  <ZoneTimeChart
                    offPctg={homeEdgeDetail.zoneTimeDetails.offensiveZonePctg}
                    neutPctg={homeEdgeDetail.zoneTimeDetails.neutralZonePctg}
                    defPctg={homeEdgeDetail.zoneTimeDetails.defensiveZonePctg}
                  />
                </View>
              )}
            </View>
          </>
        )}

        {/* Momentum */}
        {(homeMomentum || awayMomentum) && (
          <>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#e6eef8', marginBottom: 12 }}>
              Momentum
            </Text>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginBottom: 20,
            }}>
              <View style={{ flex: 1, marginRight: 8, alignItems: 'center' }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: awayTeamColor, marginBottom: 8 }}>
                  {awayAbbrev}
                </Text>
                {awayMomentum ? (
                  <MomentumSparkline data={awayMomentum.history} trend={awayMomentum.trend} teamAbbrev={awayAbbrev} compact={false} />
                ) : (
                  <Text style={{ fontSize: 11, color: '#98a6bf' }}>No data</Text>
                )}
              </View>
              <View style={{ flex: 1, marginLeft: 8, alignItems: 'center' }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: homeTeamColor, marginBottom: 8 }}>
                  {homeAbbrev}
                </Text>
                {homeMomentum ? (
                  <MomentumSparkline data={homeMomentum.history} trend={homeMomentum.trend} teamAbbrev={homeAbbrev} compact={false} />
                ) : (
                  <Text style={{ fontSize: 11, color: '#98a6bf' }}>No data</Text>
                )}
              </View>
            </View>
          </>
        )}

        {/* Clutch Performance */}
        {(homeClutch || awayClutch) && (
          <>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#e6eef8', marginBottom: 12 }}>
              Clutch Performance
            </Text>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginBottom: 20,
            }}>
              <View style={{ flex: 1, marginRight: 8, alignItems: 'center' }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: awayTeamColor, marginBottom: 8 }}>
                  {awayAbbrev}
                </Text>
                {awayClutch ? (
                  <>
                    <ClutchBadge rating={awayClutch.rating} />
                    <Text style={{ fontSize: 10, color: '#98a6bf', marginTop: 4 }}>
                      {awayClutch.oneGoalRecord} in 1-goal games
                    </Text>
                  </>
                ) : (
                  <Text style={{ fontSize: 11, color: '#98a6bf' }}>No data</Text>
                )}
              </View>
              <View style={{ flex: 1, marginLeft: 8, alignItems: 'center' }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: homeTeamColor, marginBottom: 8 }}>
                  {homeAbbrev}
                </Text>
                {homeClutch ? (
                  <>
                    <ClutchBadge rating={homeClutch.rating} />
                    <Text style={{ fontSize: 10, color: '#98a6bf', marginTop: 4 }}>
                      {homeClutch.oneGoalRecord} in 1-goal games
                    </Text>
                  </>
                ) : (
                  <Text style={{ fontSize: 11, color: '#98a6bf' }}>No data</Text>
                )}
              </View>
            </View>
          </>
        )}

        {/* High-Danger Shots Summary */}
        {(homeEdgeDetail?.sogSummary || awayEdgeDetail?.sogSummary) && (
          <>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#e6eef8', marginBottom: 12 }}>
              Shot Quality
            </Text>
            <View style={{
              backgroundColor: '#071a3699',
              borderRadius: 12,
              padding: 16,
            }}>
              {/* Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: awayTeamColor, width: 60 }}>{awayAbbrev}</Text>
                <Text style={{ fontSize: 11, color: '#98a6bf', fontWeight: '600', flex: 1, textAlign: 'center' }}>Zone</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: homeTeamColor, width: 60, textAlign: 'right' }}>{homeAbbrev}</Text>
              </View>
              {['high', 'mid', 'long'].map((zone) => {
                const awayZone = awayEdgeDetail?.sogSummary?.find(s => s.locationCode === zone);
                const homeZone = homeEdgeDetail?.sogSummary?.find(s => s.locationCode === zone);
                const zoneLabel = zone === 'high' ? 'High Danger' : zone === 'mid' ? 'Mid Range' : 'Long Range';
                return (
                  <View key={zone} style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: 8,
                    borderTopWidth: 1,
                    borderTopColor: '#192e5e44',
                  }}>
                    <Text style={{ fontSize: 11, color: '#e6eef8', width: 60 }}>
                      {awayZone ? `${awayZone.goals}G / ${awayZone.shots}S` : '—'}
                    </Text>
                    <Text style={{ fontSize: 10, color: '#98a6bf', flex: 1, textAlign: 'center' }}>{zoneLabel}</Text>
                    <Text style={{ fontSize: 11, color: '#e6eef8', width: 60, textAlign: 'right' }}>
                      {homeZone ? `${homeZone.goals}G / ${homeZone.shots}S` : '—'}
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </View>
    );
  };

  const renderScheduleTab = () => {
    const homeRestScore = restMap?.get(homeAbbrev) ?? 50;
    const awayRestScore = restMap?.get(awayAbbrev) ?? 50;
    // Convert rest score (0-100) to approximate days: 0-30 = 1d, 30-60 = 2d, 60+ = 3d+
    const homeRestDays = homeRestScore >= 60 ? 3 : homeRestScore >= 30 ? 2 : 1;
    const awayRestDays = awayRestScore >= 60 ? 3 : awayRestScore >= 30 ? 2 : 1;

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
              <Text style={{ fontSize: 13, fontWeight: '600', color: awayTeamColor, marginBottom: 6 }}>
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
              <Text style={{ fontSize: 13, fontWeight: '600', color: homeTeamColor, marginBottom: 6 }}>
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
              {awayAbbrev} is the visiting team
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
              <Ionicons name="close" size={18} color="#e6eef8" />
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
                onPress={() => setActiveTab(tab.id as typeof activeTab)}
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
            {activeTab === 'players' && renderPlayersTab()}
            {activeTab === 'edge' && renderEdgeTab()}
            {activeTab === 'schedule' && renderScheduleTab()}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
