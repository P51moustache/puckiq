import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { IconSymbol } from './ui/IconSymbol';
import { theme } from '../constants/theme';
import { getTeamColors } from '../constants/teamColors';
import { getWaiverWireRecommendations } from '../services/fantasyProjections';
import type { PlayerProjection } from '../types/fantasy';
import {
  getPlayerDetail,
  type PlayerDetail,
  type SkaterSeasonStats,
  type GoalieSeasonStats,
  type PlayerEdgeStats,
  type RecentGame,
  type SkaterTrends,
  type GoalieTrends,
  type HotColdData,
  type PaceProjections,
  type RollingStats,
  type AdvancedTrends,
} from '../services/playerDetail';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PlayerDetailModalProps {
  visible: boolean;
  playerId: number | null;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PlayerDetailModal({
  visible,
  playerId,
  onClose,
}: PlayerDetailModalProps) {
  const [detail, setDetail] = useState<PlayerDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fantasyProjection, setFantasyProjection] = useState<PlayerProjection | null>(null);

  useEffect(() => {
    if (!visible || !playerId) {
      setDetail(null);
      setError(null);
      setFantasyProjection(null);
      return;
    }

    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getPlayerDetail(playerId!);
        if (mounted) {
          if (data) {
            setDetail(data);
          } else {
            setError('Player not found');
          }
        }
      } catch {
        if (mounted) setError('Failed to load player data');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    async function loadFantasy() {
      try {
        const today = new Date().toISOString().split('T')[0];
        const all = await getWaiverWireRecommendations([], 'yahoo', today, 100);
        const match = all.find((p) => p.playerId === playerId);
        if (mounted && match) {
          setFantasyProjection(match);
        }
      } catch {
        // Non-critical
      }
    }

    load();
    loadFantasy();
    return () => { mounted = false; };
  }, [visible, playerId]);

  const teamColors = detail ? getTeamColors(detail.bio.teamAbbrev) : null;
  const isGoalie = detail?.bio.position === 'G';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Team color accent bar */}
        {teamColors && (
          <LinearGradient
            colors={[teamColors.primary, teamColors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.accentBar}
          />
        )}

        {/* Header with close button */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            testID="player-detail-close"
          >
            <IconSymbol name="xmark.circle.fill" size={28} color={theme.subtext} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.accent} />
            <Text style={styles.loadingText}>Loading player data...</Text>
          </View>
        ) : error ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : detail ? (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Player hero section */}
            <View style={styles.heroSection}>
              <Image
                source={{ uri: detail.bio.headshotUrl }}
                style={styles.heroHeadshot}
                contentFit="cover"
                cachePolicy="memory-disk"
                accessibilityLabel={`${detail.bio.fullName} headshot`}
              />
              <View style={styles.heroInfo}>
                <Text style={styles.heroName}>{detail.bio.fullName}</Text>
                <View style={styles.heroMeta}>
                  {detail.bio.sweaterNumber !== undefined && (
                    <View style={[styles.heroBadge, { borderColor: teamColors?.primary || theme.accent }]}>
                      <Text style={[styles.heroBadgeText, { color: teamColors?.primary || theme.accent }]}>
                        #{detail.bio.sweaterNumber}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.heroTeamPos}>
                    {detail.bio.teamAbbrev} / {detail.bio.position}
                  </Text>
                </View>
              </View>
            </View>

            {/* Bio section */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>BIO</Text>
              <View style={styles.bioGrid}>
                {detail.bio.heightInches !== undefined && (
                  <BioItem label="Height" value={formatHeight(detail.bio.heightInches)} />
                )}
                {detail.bio.weightPounds !== undefined && (
                  <BioItem label="Weight" value={`${detail.bio.weightPounds} lbs`} />
                )}
                {detail.bio.birthDate && (
                  <BioItem label="Age" value={String(calculateAge(detail.bio.birthDate))} />
                )}
                {detail.bio.shootsCatches && (
                  <BioItem label={isGoalie ? 'Catches' : 'Shoots'} value={detail.bio.shootsCatches} />
                )}
                {detail.bio.birthCity && (
                  <BioItem
                    label="Born"
                    value={`${detail.bio.birthCity}${detail.bio.birthCountry ? `, ${detail.bio.birthCountry}` : ''}`}
                  />
                )}
                {detail.bio.draftYear !== undefined && (
                  <BioItem
                    label="Draft"
                    value={`${detail.bio.draftYear} R${detail.bio.draftRound} P${detail.bio.draftOverall}`}
                  />
                )}
              </View>
            </View>

            {/* Season Stats */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>2024-25 SEASON</Text>
              {isGoalie
                ? renderGoalieStats(detail.seasonStats as GoalieSeasonStats)
                : renderSkaterStats(detail.seasonStats as SkaterSeasonStats)}
            </View>

            {/* Trend Data */}
            {detail.trends && (
              isGoalie
                ? renderGoalieTrends(detail.trends as GoalieTrends)
                : renderSkaterTrendsSection(detail.trends as SkaterTrends, teamColors?.primary)
            )}

            {/* Last 5 Games */}
            {detail.recentGames.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>LAST {detail.recentGames.length} GAMES</Text>
                {isGoalie
                  ? renderGoalieGamesTable(detail.recentGames)
                  : renderSkaterGamesTable(detail.recentGames)}
              </View>
            )}

            {/* Edge IQ */}
            {detail.edgeStats && renderEdgeSection(detail.edgeStats)}

            {/* Fantasy Projection */}
            {renderFantasySection(fantasyProjection)}

            {/* Career */}
            {detail.career ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>CAREER</Text>
                {detail.career.careerTotals && Object.keys(detail.career.careerTotals).length > 0 ? (
                  <View style={styles.statGrid}>
                    {Object.entries(detail.career.careerTotals).slice(0, 8).map(([key, val]) => (
                      <StatCell key={key} label={formatCareerKey(key)} value={String(val ?? '-')} />
                    ))}
                  </View>
                ) : (
                  <Text style={styles.emptyText}>Career totals not available</Text>
                )}
              </View>
            ) : (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>CAREER</Text>
                <Text style={styles.emptyText}>Career stats loading...</Text>
              </View>
            )}

            {/* Bottom padding */}
            <View style={{ height: 40 }} />
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function BioItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.bioItem}>
      <Text style={styles.bioLabel}>{label}</Text>
      <Text style={styles.bioValue}>{value}</Text>
    </View>
  );
}

function StatCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statCellLabel}>{label}</Text>
      <Text style={[styles.statCellValue, highlight && styles.statCellHighlight]}>
        {value}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Render helpers — Season Stats
// ---------------------------------------------------------------------------

function renderSkaterStats(stats: SkaterSeasonStats) {
  return (
    <View style={styles.statGrid}>
      <StatCell label="GP" value={String(stats.gamesPlayed)} />
      <StatCell label="G" value={String(stats.goals)} highlight />
      <StatCell label="A" value={String(stats.assists)} highlight />
      <StatCell label="P" value={String(stats.points)} highlight />
      <StatCell label="+/-" value={stats.plusMinus > 0 ? `+${stats.plusMinus}` : String(stats.plusMinus)} />
      <StatCell label="PIM" value={String(stats.pim)} />
      <StatCell label="S" value={String(stats.shots)} />
      <StatCell label="S%" value={stats.shootingPctg > 1 ? stats.shootingPctg.toFixed(1) : (stats.shootingPctg * 100).toFixed(1)} />
      <StatCell label="PPG" value={String(stats.powerPlayGoals)} />
      <StatCell label="TOI" value={formatToi(stats.avgToi)} />
    </View>
  );
}

function renderGoalieStats(stats: GoalieSeasonStats) {
  return (
    <View style={styles.statGrid}>
      <StatCell label="GP" value={String(stats.gamesPlayed)} />
      <StatCell label="W" value={String(stats.wins)} highlight />
      <StatCell label="L" value={String(stats.losses)} />
      <StatCell label="OT" value={String(stats.otLosses)} />
      <StatCell label="GAA" value={stats.goalsAgainstAvg.toFixed(2)} highlight />
      <StatCell label="SV%" value={formatSvPctg(stats.savePctg)} highlight />
      <StatCell label="SO" value={String(stats.shutouts)} />
      <StatCell label="SA" value={String(stats.shotsAgainst)} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Render helpers — Recent Games
// ---------------------------------------------------------------------------

function renderSkaterGamesTable(games: RecentGame[]) {
  return (
    <View style={styles.gamesTable}>
      {/* Header */}
      <View style={styles.gamesHeaderRow}>
        <Text style={[styles.gamesHeaderCell, { flex: 1.2 }]}>Game</Text>
        <Text style={styles.gamesHeaderCell}>G</Text>
        <Text style={styles.gamesHeaderCell}>A</Text>
        <Text style={styles.gamesHeaderCell}>P</Text>
        <Text style={styles.gamesHeaderCell}>+/-</Text>
        <Text style={styles.gamesHeaderCell}>S</Text>
      </View>
      {games.map((game, i) => (
        <View key={game.gameId} style={[styles.gamesRow, i % 2 === 1 && styles.gamesRowAlt]}>
          <Text style={[styles.gamesCell, { flex: 1.2 }]} numberOfLines={1}>
            {String(game.gameId).slice(-4)}
          </Text>
          <Text style={styles.gamesCell}>{game.goals}</Text>
          <Text style={styles.gamesCell}>{game.assists}</Text>
          <Text style={styles.gamesCell}>{game.points}</Text>
          <Text style={styles.gamesCell}>
            {game.plusMinus > 0 ? `+${game.plusMinus}` : game.plusMinus}
          </Text>
          <Text style={styles.gamesCell}>{game.shots ?? '-'}</Text>
        </View>
      ))}
    </View>
  );
}

function renderGoalieGamesTable(games: RecentGame[]) {
  return (
    <View style={styles.gamesTable}>
      <View style={styles.gamesHeaderRow}>
        <Text style={[styles.gamesHeaderCell, { flex: 1.2 }]}>Game</Text>
        <Text style={styles.gamesHeaderCell}>Dec</Text>
        <Text style={styles.gamesHeaderCell}>SV</Text>
        <Text style={styles.gamesHeaderCell}>GA</Text>
      </View>
      {games.map((game, i) => (
        <View key={game.gameId} style={[styles.gamesRow, i % 2 === 1 && styles.gamesRowAlt]}>
          <Text style={[styles.gamesCell, { flex: 1.2 }]} numberOfLines={1}>
            {String(game.gameId).slice(-4)}
          </Text>
          <Text style={styles.gamesCell}>{game.decision || '-'}</Text>
          <Text style={styles.gamesCell}>{game.saves ?? '-'}</Text>
          <Text style={styles.gamesCell}>{game.goalsAgainst ?? '-'}</Text>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Render helpers — Edge IQ
// ---------------------------------------------------------------------------

function renderEdgeSection(edge: PlayerEdgeStats) {
  const hasData = edge.topSpeed || edge.topShotSpeed || edge.totalDistance;
  if (!hasData) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>EDGE IQ</Text>
      <View style={styles.statGrid}>
        {edge.topSpeed !== undefined && (
          <StatCell label="Top Speed" value={`${edge.topSpeed.toFixed(1)} mph`} highlight />
        )}
        {edge.topShotSpeed !== undefined && (
          <StatCell label="Shot Speed" value={`${edge.topShotSpeed.toFixed(1)} mph`} highlight />
        )}
        {edge.totalDistance !== undefined && (
          <StatCell label="Distance" value={`${edge.totalDistance.toFixed(1)} mi`} />
        )}
        {edge.burstsOver20 !== undefined && (
          <StatCell label="Bursts 20+" value={String(edge.burstsOver20)} />
        )}
        {edge.offensiveZonePctg !== undefined && (
          <StatCell label="OZ%" value={`${(edge.offensiveZonePctg * 100).toFixed(0)}%`} />
        )}
        {edge.defensiveZonePctg !== undefined && (
          <StatCell label="DZ%" value={`${(edge.defensiveZonePctg * 100).toFixed(0)}%`} />
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Render helpers — Skater Trends
// ---------------------------------------------------------------------------

const TREND_COLORS: Record<string, string> = {
  HOT: '#ef4444',
  WARM: '#f97316',
  STEADY: '#60a5fa',
  COOL: '#38bdf8',
  COLD: '#6366f1',
};

function renderSkaterTrendsSection(trends: SkaterTrends, teamColor?: string) {
  return (
    <>
      {/* Hot/Cold Badge + Streak */}
      {trends.hotCold && renderHotColdSection(trends.hotCold)}

      {/* 82-Game Pace Projections */}
      {trends.pace && renderPaceSection(trends.pace)}

      {/* Rolling Averages */}
      {trends.rolling && renderRollingSection(trends.rolling)}

      {/* Advanced Trends */}
      {trends.advanced && renderAdvancedSection(trends.advanced)}

      {/* Three Star Count */}
      {trends.threeStarCount > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>STAR APPEARANCES</Text>
          <View style={styles.trendCard}>
            <Text style={styles.trendBigValue}>{trends.threeStarCount}</Text>
            <Text style={styles.trendCardLabel}>Three-star selections this season</Text>
          </View>
        </View>
      )}
    </>
  );
}

function renderHotColdSection(hc: HotColdData) {
  const color = TREND_COLORS[hc.trendLabel] || theme.accent;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>TREND</Text>
      <View style={styles.trendCard}>
        <View style={styles.trendHeaderRow}>
          <View style={[styles.trendBadge, { backgroundColor: color + '22', borderColor: color }]}>
            <Text style={[styles.trendBadgeText, { color }]}>{hc.trendLabel}</Text>
          </View>
          {hc.pointStreak > 0 && (
            <Text style={styles.trendStreakText}>{hc.pointStreak}-game point streak</Text>
          )}
        </View>
        <View style={styles.trendCompareRow}>
          <TrendCompareItem label="PPG" recent={hc.recentPpg.toFixed(2)} season={hc.seasonPpg.toFixed(2)} />
          <TrendCompareItem label="GPG" recent={hc.recentGpg.toFixed(2)} season={hc.seasonGpg.toFixed(2)} />
          <TrendCompareItem
            label="S%"
            recent={`${hc.recentShootingPct.toFixed(1)}`}
            season={`${hc.seasonShootingPct.toFixed(1)}`}
          />
        </View>
      </View>
    </View>
  );
}

function TrendCompareItem({ label, recent, season }: { label: string; recent: string; season: string }) {
  return (
    <View style={styles.trendCompareItem}>
      <Text style={styles.trendCompareLabel}>{label}</Text>
      <Text style={styles.trendCompareRecent}>{recent}</Text>
      <Text style={styles.trendCompareSeason}>Season: {season}</Text>
    </View>
  );
}

function renderPaceSection(pace: PaceProjections) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>82-GAME PACE</Text>
      <View style={styles.statGrid}>
        <StatCell label="G" value={String(pace.projectedGoals82)} highlight />
        <StatCell label="A" value={String(pace.projectedAssists82)} highlight />
        <StatCell label="P" value={String(pace.projectedPoints82)} highlight />
        <StatCell label="S" value={String(pace.projectedShots82)} />
        <StatCell label="PPG" value={pace.projectedPpg82.toFixed(2)} />
      </View>
    </View>
  );
}

function renderRollingSection(rolling: RollingStats) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>ROLLING AVERAGES</Text>
      <View style={styles.gamesTable}>
        <View style={styles.gamesHeaderRow}>
          <Text style={[styles.gamesHeaderCell, { flex: 1.5 }]}>Window</Text>
          <Text style={styles.gamesHeaderCell}>G</Text>
          <Text style={styles.gamesHeaderCell}>A</Text>
          <Text style={styles.gamesHeaderCell}>P</Text>
          <Text style={styles.gamesHeaderCell}>S</Text>
        </View>
        <View style={styles.gamesRow}>
          <Text style={[styles.gamesCell, { flex: 1.5 }]}>Last 5</Text>
          <Text style={styles.gamesCell}>{rolling.avgGoals5g.toFixed(1)}</Text>
          <Text style={styles.gamesCell}>{rolling.avgAssists5g.toFixed(1)}</Text>
          <Text style={styles.gamesCell}>{rolling.avgPoints5g.toFixed(1)}</Text>
          <Text style={styles.gamesCell}>{rolling.avgShots5g.toFixed(1)}</Text>
        </View>
        <View style={[styles.gamesRow, styles.gamesRowAlt]}>
          <Text style={[styles.gamesCell, { flex: 1.5 }]}>Last 10</Text>
          <Text style={styles.gamesCell}>{rolling.avgGoals10g.toFixed(1)}</Text>
          <Text style={styles.gamesCell}>{rolling.avgAssists10g.toFixed(1)}</Text>
          <Text style={styles.gamesCell}>{rolling.avgPoints10g.toFixed(1)}</Text>
          <Text style={styles.gamesCell}>{rolling.avgShots10g.toFixed(1)}</Text>
        </View>
        <View style={styles.gamesRow}>
          <Text style={[styles.gamesCell, { flex: 1.5 }]}>Season</Text>
          <Text style={styles.gamesCell}>{rolling.seasonAvgGoals.toFixed(1)}</Text>
          <Text style={styles.gamesCell}>-</Text>
          <Text style={styles.gamesCell}>{rolling.seasonAvgPoints.toFixed(1)}</Text>
          <Text style={styles.gamesCell}>-</Text>
        </View>
      </View>
    </View>
  );
}

function renderAdvancedSection(adv: AdvancedTrends) {
  if (adv.gamesWithAdvanced === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>ADVANCED TRENDS</Text>
      <View style={styles.gamesTable}>
        <View style={styles.gamesHeaderRow}>
          <Text style={[styles.gamesHeaderCell, { flex: 1.5 }]}>Window</Text>
          <Text style={styles.gamesHeaderCell}>CF%</Text>
          <Text style={styles.gamesHeaderCell}>FF%</Text>
          <Text style={styles.gamesHeaderCell}>PDO</Text>
        </View>
        {adv.avgCorsiPct5g !== undefined && (
          <View style={styles.gamesRow}>
            <Text style={[styles.gamesCell, { flex: 1.5 }]}>Last 5</Text>
            <Text style={styles.gamesCell}>{adv.avgCorsiPct5g.toFixed(1)}</Text>
            <Text style={styles.gamesCell}>{adv.avgFenwickPct5g?.toFixed(1) ?? '-'}</Text>
            <Text style={styles.gamesCell}>{adv.avgPdo5g?.toFixed(1) ?? '-'}</Text>
          </View>
        )}
        {adv.avgCorsiPct10g !== undefined && (
          <View style={[styles.gamesRow, styles.gamesRowAlt]}>
            <Text style={[styles.gamesCell, { flex: 1.5 }]}>Last 10</Text>
            <Text style={styles.gamesCell}>{adv.avgCorsiPct10g.toFixed(1)}</Text>
            <Text style={styles.gamesCell}>{adv.avgFenwickPct10g?.toFixed(1) ?? '-'}</Text>
            <Text style={styles.gamesCell}>{adv.avgPdo10g?.toFixed(1) ?? '-'}</Text>
          </View>
        )}
        {adv.seasonCorsiPct !== undefined && (
          <View style={styles.gamesRow}>
            <Text style={[styles.gamesCell, { flex: 1.5 }]}>Season</Text>
            <Text style={styles.gamesCell}>{adv.seasonCorsiPct.toFixed(1)}</Text>
            <Text style={styles.gamesCell}>{adv.seasonFenwickPct?.toFixed(1) ?? '-'}</Text>
            <Text style={styles.gamesCell}>{adv.seasonPdo?.toFixed(1) ?? '-'}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Render helpers — Goalie Trends
// ---------------------------------------------------------------------------

function renderGoalieTrends(trends: GoalieTrends) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>ROLLING TRENDS</Text>
      <View style={styles.gamesTable}>
        <View style={styles.gamesHeaderRow}>
          <Text style={[styles.gamesHeaderCell, { flex: 1.5 }]}>Window</Text>
          <Text style={styles.gamesHeaderCell}>GAA</Text>
          <Text style={styles.gamesHeaderCell}>SV%</Text>
          <Text style={styles.gamesHeaderCell}>W</Text>
        </View>
        <View style={styles.gamesRow}>
          <Text style={[styles.gamesCell, { flex: 1.5 }]}>Last 5</Text>
          <Text style={styles.gamesCell}>{trends.avgGa5g.toFixed(2)}</Text>
          <Text style={styles.gamesCell}>{trends.savePct5g != null ? formatSvPctg(trends.savePct5g) : '-'}</Text>
          <Text style={styles.gamesCell}>{trends.wins5g}</Text>
        </View>
        <View style={[styles.gamesRow, styles.gamesRowAlt]}>
          <Text style={[styles.gamesCell, { flex: 1.5 }]}>Last 10</Text>
          <Text style={styles.gamesCell}>{trends.avgGa10g.toFixed(2)}</Text>
          <Text style={styles.gamesCell}>{trends.savePct10g != null ? formatSvPctg(trends.savePct10g) : '-'}</Text>
          <Text style={styles.gamesCell}>{trends.wins10g}</Text>
        </View>
        <View style={styles.gamesRow}>
          <Text style={[styles.gamesCell, { flex: 1.5 }]}>Season</Text>
          <Text style={styles.gamesCell}>{trends.seasonAvgGa.toFixed(2)}</Text>
          <Text style={styles.gamesCell}>{trends.seasonSavePct != null ? formatSvPctg(trends.seasonSavePct) : '-'}</Text>
          <Text style={styles.gamesCell}>{trends.seasonWins}</Text>
        </View>
      </View>
      {trends.seasonShutouts > 0 && (
        <View style={[styles.trendCard, { marginTop: 8 }]}>
          <Text style={styles.trendCardLabel}>Shutouts: {trends.seasonShutouts}</Text>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Render helpers — Fantasy Projection
// ---------------------------------------------------------------------------

const REC_COLORS: Record<string, { bg: string; text: string }> = {
  START: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e' },
  UPSIDE: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6' },
  FLEX: { bg: 'rgba(251, 191, 36, 0.15)', text: '#fbbf24' },
  SIT: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
};

function renderFantasySection(projection: PlayerProjection | null) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>FANTASY</Text>
      {projection ? (
        <View style={styles.trendCard}>
          {/* Projected points + recommendation */}
          <View style={styles.fantasyTopRow}>
            <View style={styles.fantasyPointsBox}>
              <Text style={styles.trendBigValue}>{projection.fantasyPoints.toFixed(1)}</Text>
              <Text style={styles.trendCardLabel}>Projected FPts</Text>
            </View>
            <View style={styles.fantasyRecBox}>
              {(() => {
                const rc = REC_COLORS[projection.recommendation] || REC_COLORS.FLEX;
                return (
                  <View style={[styles.fantasyRecBadge, { backgroundColor: rc.bg, borderColor: rc.text }]}>
                    <Text style={[styles.fantasyRecText, { color: rc.text }]}>
                      {projection.recommendation}
                    </Text>
                  </View>
                );
              })()}
              {projection.reason ? (
                <Text style={styles.fantasyReasonText} numberOfLines={2}>{projection.reason}</Text>
              ) : null}
            </View>
          </View>

          {/* Floor / Ceiling bar */}
          <View style={styles.fantasyBarContainer}>
            <View style={styles.fantasyBarLabels}>
              <Text style={styles.fantasyBarLabel}>Floor: {projection.floor.toFixed(1)}</Text>
              <Text style={styles.fantasyBarLabel}>Ceil: {projection.ceiling.toFixed(1)}</Text>
            </View>
            <View style={styles.fantasyBarTrack}>
              <View
                style={[
                  styles.fantasyBarFill,
                  {
                    left: '0%',
                    width: projection.ceiling > 0
                      ? `${Math.min(100, (projection.fantasyPoints / projection.ceiling) * 100)}%`
                      : '50%',
                  },
                ]}
              />
            </View>
          </View>

          {/* Category breakdown */}
          <View style={styles.fantasyCategoryRow}>
            <View style={styles.fantasyCat}>
              <Text style={styles.fantasyCatValue}>{projection.predGoals.toFixed(1)}</Text>
              <Text style={styles.fantasyCatLabel}>G</Text>
            </View>
            <View style={styles.fantasyCat}>
              <Text style={styles.fantasyCatValue}>{projection.predAssists.toFixed(1)}</Text>
              <Text style={styles.fantasyCatLabel}>A</Text>
            </View>
            <View style={styles.fantasyCat}>
              <Text style={styles.fantasyCatValue}>{projection.predSog.toFixed(1)}</Text>
              <Text style={styles.fantasyCatLabel}>SOG</Text>
            </View>
            <View style={styles.fantasyCat}>
              <Text style={styles.fantasyCatValue}>{projection.predHits.toFixed(1)}</Text>
              <Text style={styles.fantasyCatLabel}>Hits</Text>
            </View>
            <View style={styles.fantasyCat}>
              <Text style={styles.fantasyCatValue}>{projection.predBlocks.toFixed(1)}</Text>
              <Text style={styles.fantasyCatLabel}>Blk</Text>
            </View>
          </View>

          {/* Opponent */}
          {projection.opponentAbbrev && (
            <Text style={styles.fantasyOpponent}>
              {projection.isHome ? 'vs' : '@'} {projection.opponentAbbrev}
            </Text>
          )}
        </View>
      ) : (
        <View style={styles.trendCard}>
          <View style={styles.fantasyEmptyContainer}>
            <Ionicons name="calendar-outline" size={24} color={theme.subtext} />
            <Text style={styles.emptyText}>No projection available — player may not be playing today</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatHeight(inches: number): string {
  const ft = Math.floor(inches / 12);
  const remainder = inches % 12;
  return `${ft}'${remainder}"`;
}

function calculateAge(birthDate: string): number {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function formatToi(avgToi: number): string {
  if (avgToi === 0) return '0:00';
  const minutes = Math.floor(avgToi / 60);
  const seconds = Math.round(avgToi % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatSvPctg(pctg: number): string {
  if (pctg >= 1) return pctg.toFixed(3);
  return `.${Math.round(pctg * 1000)}`;
}

function formatCareerKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  accentBar: {
    height: 4,
    width: '100%',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 52 : 16,
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  closeButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: theme.subtext,
  },
  errorText: {
    fontSize: 14,
    color: '#f87171',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  // Hero
  heroSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 16,
  },
  heroHeadshot: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.subtle,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  heroInfo: {
    flex: 1,
  },
  heroName: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.text,
    marginBottom: 6,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroBadge: {
    borderWidth: 2,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  heroBadgeText: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
  heroTeamPos: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.subtext,
  },

  // Sections
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.accent,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },

  // Bio grid
  bioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 12,
    gap: 0,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  bioItem: {
    width: '50%',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  bioLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.subtext,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  bioValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },

  // Stat grid
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  statCell: {
    width: '20%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statCellLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.subtext,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  statCellValue: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.text,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontVariant: ['tabular-nums'] as any,
  },
  statCellHighlight: {
    color: theme.accent,
  },

  // Games table
  gamesTable: {
    backgroundColor: theme.card,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  gamesHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  gamesHeaderCell: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: theme.subtext,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  gamesRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  gamesRowAlt: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  gamesCell: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: theme.text,
    textAlign: 'center',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontVariant: ['tabular-nums'] as any,
  },

  emptyText: {
    fontSize: 13,
    color: theme.subtext,
    textAlign: 'center',
    paddingVertical: 16,
  },

  // Trend cards
  trendCard: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  trendBigValue: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.accent,
    textAlign: 'center',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontVariant: ['tabular-nums'] as any,
  },
  trendCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.subtext,
    textAlign: 'center',
    marginTop: 4,
  },
  trendHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  trendBadge: {
    borderWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  trendBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  trendStreakText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.subtext,
  },
  trendCompareRow: {
    flexDirection: 'row',
    gap: 8,
  },
  trendCompareItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  trendCompareLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.subtext,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  trendCompareRecent: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.text,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontVariant: ['tabular-nums'] as any,
  },
  trendCompareSeason: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.subtext,
    marginTop: 2,
  },

  // Fantasy section
  fantasyTopRow: {
    flexDirection: 'row',
    marginBottom: 14,
    gap: 14,
  },
  fantasyPointsBox: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  fantasyRecBox: {
    flex: 1,
    justifyContent: 'center',
    gap: 6,
  },
  fantasyRecBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  fantasyRecText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  fantasyReasonText: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.subtext,
  },
  fantasyBarContainer: {
    marginBottom: 14,
  },
  fantasyBarLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  fantasyBarLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.subtext,
  },
  fantasyBarTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  fantasyBarFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: theme.accent,
    borderRadius: 3,
  },
  fantasyCategoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  fantasyCat: {
    alignItems: 'center',
  },
  fantasyCatValue: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.text,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontVariant: ['tabular-nums'] as any,
  },
  fantasyCatLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.subtext,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  fantasyOpponent: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.subtext,
    textAlign: 'center',
    marginTop: 4,
  },
  fantasyEmptyContainer: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
});
