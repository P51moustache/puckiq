import React, { useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { makeStyles } from '../constants/theme';

interface PowerRankingsWidgetProps {
  rankings: any[];
}

type Conference = 'all' | 'eastern' | 'western';

export default function PowerRankingsWidget({ rankings }: PowerRankingsWidgetProps) {
  const styles = makeStyles();
  const [selectedConference, setSelectedConference] = useState<Conference>('all');
  const [showFullRankings, setShowFullRankings] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);

  if (!rankings || rankings.length === 0) return null;

  // Conference definitions
  const easternTeams = ['BOS', 'BUF', 'CAR', 'CBJ', 'DET', 'FLA', 'MTL', 'NJD', 'NYI', 'NYR', 'OTT', 'PHI', 'PIT', 'TBL', 'TOR', 'WSH'];
  const westernTeams = ['ANA', 'ARI', 'CGY', 'CHI', 'COL', 'DAL', 'EDM', 'LAK', 'MIN', 'NSH', 'SEA', 'SJS', 'STL', 'VAN', 'VGK', 'WPG'];

  // Filter teams by conference
  const allFilteredRankings = rankings.filter(team => {
    const abbrev = team.teamAbbrev?.default || team.teamAbbrev || '';
    if (selectedConference === 'all') return true;
    if (selectedConference === 'eastern') return easternTeams.includes(abbrev);
    if (selectedConference === 'western') return westernTeams.includes(abbrev);
    return true;
  });

  // Top 10 for main card display
  const top10Rankings = allFilteredRankings.slice(0, 10);

  const getTrendIcon = (trend: string) => {
    if (trend === 'up') return '↑';
    if (trend === 'down') return '↓';
    return '→';
  };

  const getTrendColor = (trend: string) => {
    if (trend === 'up') return '#10b981';
    if (trend === 'down') return '#ef4444';
    return '#98a6bf';
  };

  const getStreakInfo = (streakCode: string) => {
    if (!streakCode) return { text: '-', isHot: false, isCold: false };
    const streakNum = parseInt(streakCode.substring(1)) || 0;
    const isWin = streakCode.startsWith('W');
    return {
      text: streakCode,
      isHot: isWin && streakNum >= 3,
      isCold: !isWin && streakNum >= 3
    };
  };

  const getLastFiveRecord = (team: any) => {
    // Simplified - in real implementation, you'd calculate from recent games
    // For now, we'll show a placeholder or derive from streak
    const streak = team.streakCode || '';
    if (streak.startsWith('W') || streak.startsWith('L')) {
      const count = parseInt(streak.substring(1)) || 0;
      if (streak.startsWith('W')) {
        return `${Math.min(count, 5)}-${Math.max(0, 5 - count)}`;
      } else {
        return `${Math.max(0, 5 - count)}-${Math.min(count, 5)}`;
      }
    }
    return '3-2'; // Default placeholder
  };

  const renderTeamRow = (team: any, idx: number, onPress?: () => void) => {
    const abbrev = team.teamAbbrev?.default || team.teamAbbrev || 'N/A';
    const goalDiff = (team.goalFor || 0) - (team.goalAgainst || 0);
    const pointsPct = team.pointPctg ? (team.pointPctg * 100).toFixed(1) : '0.0';
    const streak = getStreakInfo(team.streakCode);
    const lastFive = getLastFiveRecord(team);

    return (
      <TouchableOpacity
        key={abbrev + idx}
        onPress={onPress}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 10,
          paddingHorizontal: 4,
          borderBottomWidth: 1,
          borderBottomColor: '#192e5e44',
          backgroundColor: streak.isHot ? '#10b98108' : streak.isCold ? '#ef444408' : 'transparent',
        }}
      >
        {/* Rank */}
        <View style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: idx < 3 ? '#f59e0b33' : '#192e5e44',
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 10,
        }}>
          <Text style={{
            fontSize: 14,
            fontWeight: '800',
            color: idx < 3 ? '#f59e0b' : '#e6eef8',
          }}>
            {idx + 1}
          </Text>
        </View>

        {/* Team Info */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
            <Text style={{
              fontSize: 15,
              fontWeight: '700',
              color: '#e6eef8',
              marginRight: 8,
            }}>
              {abbrev}
            </Text>
            {/* Streak Badge */}
            <View style={{
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 4,
              backgroundColor: streak.isHot ? '#10b98122' : streak.isCold ? '#ef444422' : '#192e5e44',
            }}>
              <Text style={{
                fontSize: 10,
                fontWeight: '700',
                color: streak.isHot ? '#10b981' : streak.isCold ? '#ef4444' : '#98a6bf',
              }}>
                {streak.text}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{
              fontSize: 11,
              color: '#98a6bf',
            }}>
              {team.wins}-{team.losses}-{team.otLosses || 0}
            </Text>
            <Text style={{
              fontSize: 10,
              color: '#98a6bf',
            }}>
              •
            </Text>
            <Text style={{
              fontSize: 11,
              color: '#98a6bf',
            }}>
              L5: {lastFive}
            </Text>
          </View>
        </View>

        {/* Stats Column */}
        <View style={{ alignItems: 'flex-end', marginRight: 8 }}>
          <Text style={{
            fontSize: 15,
            fontWeight: '700',
            color: '#e6eef8',
            marginBottom: 2,
          }}>
            {team.points} pts
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{
              fontSize: 10,
              color: goalDiff > 0 ? '#10b981' : goalDiff < 0 ? '#ef4444' : '#98a6bf',
              fontWeight: '600',
            }}>
              {goalDiff > 0 ? '+' : ''}{goalDiff}
            </Text>
            <Text style={{
              fontSize: 10,
              color: '#98a6bf',
            }}>
              •
            </Text>
            <Text style={{
              fontSize: 10,
              color: '#98a6bf',
              fontWeight: '600',
            }}>
              {pointsPct}%
            </Text>
          </View>
        </View>

        {/* Trend Indicator */}
        <View style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: `${getTrendColor(team.trend)}22`,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <Text style={{
            fontSize: 14,
            color: getTrendColor(team.trend),
          }}>
            {getTrendIcon(team.trend)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const ConferenceFilter = () => (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {(['all', 'eastern', 'western'] as Conference[]).map(conf => (
        <TouchableOpacity
          key={conf}
          onPress={() => setSelectedConference(conf)}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 6,
            backgroundColor: selectedConference === conf ? '#60a5fa22' : '#192e5e44',
            borderWidth: selectedConference === conf ? 1 : 0,
            borderColor: '#60a5fa',
          }}
        >
          <Text style={{
            fontSize: 10,
            fontWeight: '700',
            color: selectedConference === conf ? '#60a5fa' : '#98a6bf',
            textTransform: 'uppercase',
          }}>
            {conf === 'all' ? 'All' : conf === 'eastern' ? 'East' : 'West'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <>
      <View style={{
        alignSelf: 'stretch',
        backgroundColor: styles.card.backgroundColor,
        borderRadius: 14,
        padding: 16,
        marginBottom: 0,
        marginTop: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 6,
      }}>
        {/* Header */}
        <TouchableOpacity
          onPress={() => setShowFullRankings(true)}
          style={{ marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <View>
            <Text style={{
              fontSize: 20,
              fontWeight: '800',
              color: '#e6eef8',
              marginBottom: 4,
            }}>
              Power Rankings
            </Text>
            <Text style={{
              fontSize: 11,
              color: '#60a5fa',
              fontWeight: '600',
            }}>
              Tap to see all 32 teams →
            </Text>
          </View>
          <ConferenceFilter />
        </TouchableOpacity>

        {/* Legend */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: 4,
          paddingVertical: 6,
          marginBottom: 8,
          borderBottomWidth: 1,
          borderBottomColor: '#192e5e66',
        }}>
          <Text style={{ fontSize: 10, color: '#98a6bf', fontWeight: '600', flex: 1 }}>TEAM</Text>
          <Text style={{ fontSize: 10, color: '#98a6bf', fontWeight: '600', textAlign: 'right', marginRight: 40 }}>
            PTS • GD • PCT%
          </Text>
        </View>

        {/* Rankings List */}
        <View>
          {top10Rankings.map((team, idx) => renderTeamRow(team, idx, () => setSelectedTeam(team)))}
        </View>

        {/* Footer */}
        <Text style={{
          fontSize: 10,
          color: '#98a6bf',
          textAlign: 'center',
          marginTop: 12,
          opacity: 0.8,
          fontStyle: 'italic',
        }}>
          Rankings based on points, recent form, and goal differential
        </Text>
      </View>

      {/* Full Rankings Modal */}
      <Modal
        visible={showFullRankings}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFullRankings(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <View style={{
            backgroundColor: styles.card.backgroundColor,
            borderRadius: 16,
            padding: 20,
            width: '90%',
            maxHeight: '85%',
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: '#e6eef8' }}>
                Full Rankings
              </Text>
              <TouchableOpacity onPress={() => setShowFullRankings(false)}>
                <Text style={{ fontSize: 28, color: '#98a6bf' }}>×</Text>
              </TouchableOpacity>
            </View>

            <ConferenceFilter />

            <ScrollView style={{ marginTop: 16 }} showsVerticalScrollIndicator={false}>
              {allFilteredRankings.map((team, idx) => renderTeamRow(team, idx, () => {
                setShowFullRankings(false);
                setSelectedTeam(team);
              }))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Team Details Modal */}
      <Modal
        visible={!!selectedTeam}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedTeam(null)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          activeOpacity={1}
          onPress={() => setSelectedTeam(null)}
        >
          <TouchableOpacity
            style={{
              backgroundColor: styles.card.backgroundColor,
              borderRadius: 16,
              padding: 24,
              width: '85%',
              maxHeight: '70%',
            }}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {selectedTeam && (
              <>
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 28, fontWeight: '800', color: '#e6eef8', marginBottom: 4 }}>
                    {selectedTeam.teamAbbrev?.default || selectedTeam.teamAbbrev}
                  </Text>
                  <Text style={{ fontSize: 14, color: '#98a6bf' }}>
                    {selectedTeam.teamName?.default || selectedTeam.teamName || 'Team Details'}
                  </Text>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Record Section */}
                  <View style={{ marginBottom: 20 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#60a5fa', marginBottom: 10 }}>
                      SEASON RECORD
                    </Text>
                    <View style={{ backgroundColor: styles.factbox.backgroundColor, borderRadius: 8, padding: 12 }}>
                      <Text style={{ fontSize: 32, fontWeight: '800', color: '#e6eef8', textAlign: 'center', marginBottom: 8 }}>
                        {selectedTeam.wins}-{selectedTeam.losses}-{selectedTeam.otLosses || 0}
                      </Text>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 }}>
                        <View style={{ alignItems: 'center' }}>
                          <Text style={{ fontSize: 11, color: '#98a6bf', marginBottom: 4 }}>Points</Text>
                          <Text style={{ fontSize: 18, fontWeight: '700', color: '#e6eef8' }}>{selectedTeam.points}</Text>
                        </View>
                        <View style={{ alignItems: 'center' }}>
                          <Text style={{ fontSize: 11, color: '#98a6bf', marginBottom: 4 }}>Pts %</Text>
                          <Text style={{ fontSize: 18, fontWeight: '700', color: '#e6eef8' }}>
                            {selectedTeam.pointPctg ? (selectedTeam.pointPctg * 100).toFixed(1) : '0.0'}%
                          </Text>
                        </View>
                        <View style={{ alignItems: 'center' }}>
                          <Text style={{ fontSize: 11, color: '#98a6bf', marginBottom: 4 }}>Streak</Text>
                          <Text style={{ fontSize: 18, fontWeight: '700', color: '#e6eef8' }}>
                            {selectedTeam.streakCode || '-'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Goals Section */}
                  <View style={{ marginBottom: 20 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#60a5fa', marginBottom: 10 }}>
                      SCORING
                    </Text>
                    <View style={{ backgroundColor: styles.factbox.backgroundColor, borderRadius: 8, padding: 12 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                        <View style={{ alignItems: 'center', flex: 1 }}>
                          <Text style={{ fontSize: 11, color: '#98a6bf', marginBottom: 4 }}>Goals For</Text>
                          <Text style={{ fontSize: 24, fontWeight: '700', color: '#10b981' }}>{selectedTeam.goalFor || 0}</Text>
                        </View>
                        <View style={{ alignItems: 'center', flex: 1 }}>
                          <Text style={{ fontSize: 11, color: '#98a6bf', marginBottom: 4 }}>Goals Against</Text>
                          <Text style={{ fontSize: 24, fontWeight: '700', color: '#ef4444' }}>{selectedTeam.goalAgainst || 0}</Text>
                        </View>
                        <View style={{ alignItems: 'center', flex: 1 }}>
                          <Text style={{ fontSize: 11, color: '#98a6bf', marginBottom: 4 }}>Differential</Text>
                          <Text style={{
                            fontSize: 24,
                            fontWeight: '700',
                            color: ((selectedTeam.goalFor || 0) - (selectedTeam.goalAgainst || 0)) > 0 ? '#10b981' : '#ef4444'
                          }}>
                            {((selectedTeam.goalFor || 0) - (selectedTeam.goalAgainst || 0)) > 0 ? '+' : ''}
                            {(selectedTeam.goalFor || 0) - (selectedTeam.goalAgainst || 0)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Standings Section */}
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#60a5fa', marginBottom: 10 }}>
                      STANDINGS
                    </Text>
                    <View style={{ backgroundColor: styles.factbox.backgroundColor, borderRadius: 8, padding: 12 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={{ fontSize: 12, color: '#98a6bf' }}>Conference Rank:</Text>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#e6eef8' }}>
                          #{selectedTeam.conferenceSequence || '-'}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={{ fontSize: 12, color: '#98a6bf' }}>Division Rank:</Text>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#e6eef8' }}>
                          #{selectedTeam.divisionSequence || '-'}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 12, color: '#98a6bf' }}>League Rank:</Text>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#e6eef8' }}>
                          #{selectedTeam.leagueSequence || '-'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </ScrollView>

                <TouchableOpacity
                  onPress={() => setSelectedTeam(null)}
                  style={{
                    backgroundColor: '#60a5fa',
                    paddingVertical: 12,
                    borderRadius: 8,
                    marginTop: 16,
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center', fontSize: 14 }}>
                    Close
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}
