import { useState, useEffect, lazy, Suspense } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Modal,
  Platform,
} from 'react-native';
import { theme } from '../../constants/theme';
import { ThemedView } from '../../components/ThemedView';
import { FactorLeaderboard } from '../../components/FactorLeaderboard';
import { useAnalytics } from '../../hooks/useAnalytics';
import { getTeamComparisonData, calculateCategoryWinners } from '../../services/teamComparison';
import type { TeamComparisonStats, CategoryWinner } from '../../types/teamStats';
import { fetchEdgeSkaterLanding, fetchEdgeTeamLanding, fetchEdgeByTheNumbers } from '../../services/edgeStats';
import type { EdgeSkaterLanding, EdgeTeamLanding, EdgeByTheNumbers } from '../../types/edgeStats';
import SpeedGauge from '../../components/SpeedGauge';

const TeamsContent = lazy(() => import('./teams'));
const ModelsContent = lazy(() => import('./models'));

type Segment = 'teams' | 'edge' | 'factors' | 'models';

const SEGMENTS: { key: Segment; label: string; testID: string }[] = [
  { key: 'teams', label: 'Teams', testID: 'stats-segment-teams' },
  { key: 'edge', label: 'Edge', testID: 'stats-segment-edge' },
  { key: 'factors', label: 'Factors', testID: 'stats-segment-factors' },
  { key: 'models', label: 'Models', testID: 'stats-segment-models' },
];

// Stat tooltips for advanced metrics
const STAT_TOOLTIPS: Record<string, string> = {
  'Corsi': 'Shot attempts (for minus against) at even strength. Positive = team controls puck more.',
  'Fenwick': 'Like Corsi but excludes blocked shots. A purer measure of shot generation.',
  'xG': 'Expected Goals — the quality of scoring chances based on shot location and type.',
  'PDO': 'Shooting % + Save %. Tends toward 100 over time. High PDO = likely unsustainable.',
  'PP%': 'Power Play Percentage — goals scored per power play opportunity.',
  'PK%': 'Penalty Kill Percentage — percentage of opponent power plays killed without allowing a goal.',
  'SV%': 'Save Percentage — shots saved divided by total shots faced.',
  'GAA': 'Goals Against Average — average goals allowed per 60 minutes of play.',
  'GF/GP': 'Goals For per Game Played — offensive output per game.',
  'GA/GP': 'Goals Against per Game Played — defensive efficiency per game.',
};

const ALL_TEAMS = [
  'ANA', 'BOS', 'BUF', 'CAR', 'CBJ', 'CGY', 'CHI', 'COL', 'DAL', 'DET',
  'EDM', 'FLA', 'LAK', 'MIN', 'MTL', 'NJD', 'NSH', 'NYI', 'NYR', 'OTT',
  'PHI', 'PIT', 'SEA', 'SJS', 'STL', 'TBL', 'TOR', 'UTA', 'VAN', 'VGK',
  'WPG', 'WSH',
];

// Stat Tooltip Component
function StatTooltip({ visible, stat, onClose }: { visible: boolean; stat: string; onClose: () => void }) {
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={localStyles.tooltipOverlay} activeOpacity={1} onPress={onClose}>
        <View style={localStyles.tooltipContainer}>
          <Text style={localStyles.tooltipTitle}>{stat}</Text>
          <Text style={localStyles.tooltipText}>{STAT_TOOLTIPS[stat] || 'No description available.'}</Text>
          <TouchableOpacity onPress={onClose} style={localStyles.tooltipClose}>
            <Text style={localStyles.tooltipCloseText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// Team Comparison Component
function TeamComparisonTool() {
  const [teamA, setTeamA] = useState<string>('');
  const [teamB, setTeamB] = useState<string>('');
  const [statsA, setStatsA] = useState<TeamComparisonStats | null>(null);
  const [statsB, setStatsB] = useState<TeamComparisonStats | null>(null);
  const [winners, setWinners] = useState<CategoryWinner | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPickerA, setShowPickerA] = useState(false);
  const [showPickerB, setShowPickerB] = useState(false);

  const compare = async () => {
    if (!teamA || !teamB || teamA === teamB) return;
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        getTeamComparisonData(teamA),
        getTeamComparisonData(teamB),
      ]);
      setStatsA(a);
      setStatsB(b);
      setWinners(calculateCategoryWinners(a, b));
    } catch (error) {
      // Team comparison failed — show empty state
      setStatsA(null);
      setStatsB(null);
      setWinners(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (teamA && teamB && teamA !== teamB) {
      compare();
    }
  }, [teamA, teamB]);

  const renderTeamPicker = (selected: string, onSelect: (t: string) => void, showPicker: boolean, setShowPicker: (v: boolean) => void) => (
    <View>
      <TouchableOpacity
        style={localStyles.teamPickerButton}
        onPress={() => setShowPicker(true)}
      >
        <Text style={localStyles.teamPickerText}>
          {selected || 'Select Team'}
        </Text>
      </TouchableOpacity>
      <Modal visible={showPicker} transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
        <TouchableOpacity style={localStyles.tooltipOverlay} activeOpacity={1} onPress={() => setShowPicker(false)}>
          <View style={localStyles.pickerContainer}>
            <Text style={localStyles.pickerTitle}>Select Team</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {ALL_TEAMS.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[localStyles.pickerItem, t === selected && localStyles.pickerItemActive]}
                  onPress={() => { onSelect(t); setShowPicker(false); }}
                >
                  <Text style={[localStyles.pickerItemText, t === selected && localStyles.pickerItemTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );

  const renderCategoryRow = (label: string, winner: string | undefined) => {
    const color = winner === 'home' ? '#22c55e' : winner === 'away' ? '#ef4444' : theme.subtext;
    const winLabel = winner === 'home' ? teamA : winner === 'away' ? teamB : 'Tie';
    return (
      <View key={label} style={localStyles.categoryRow}>
        <Text style={localStyles.categoryLabel}>{label}</Text>
        <Text style={[localStyles.categoryWinner, { color }]}>{winLabel}</Text>
      </View>
    );
  };

  return (
    <View style={localStyles.comparisonContainer}>
      <View style={{ marginBottom: 4 }}>
        <Text style={localStyles.comparisonTitle}>Team Comparison</Text>
        <View style={{ width: 32, height: 2, backgroundColor: theme.accent, borderRadius: 1, marginTop: 4, opacity: 0.6 }} />
      </View>
      <Text style={localStyles.comparisonSubtitle}>Compare two teams head-to-head</Text>

      <View style={localStyles.pickerRow}>
        {renderTeamPicker(teamA, setTeamA, showPickerA, setShowPickerA)}
        <Text style={localStyles.vsText}>vs</Text>
        {renderTeamPicker(teamB, setTeamB, showPickerB, setShowPickerB)}
      </View>

      {loading && <ActivityIndicator size="small" color={theme.accent} style={{ marginTop: 16 }} />}

      {winners && statsA && statsB && !loading && (
        <View style={localStyles.resultsContainer}>
          {renderCategoryRow('Offense', winners.offense)}
          {renderCategoryRow('Defense', winners.defense)}
          {renderCategoryRow('Special Teams', winners.specialTeams)}
          {renderCategoryRow('Goaltending', winners.goaltending)}
          {renderCategoryRow('Discipline', winners.discipline)}
        </View>
      )}
    </View>
  );
}

// Edge content — season leaders + last game night
function EdgeContent() {
  const [skaterLanding, setSkaterLanding] = useState<EdgeSkaterLanding | null>(null);
  const [teamLanding, setTeamLanding] = useState<EdgeTeamLanding | null>(null);
  const [byTheNumbers, setByTheNumbers] = useState<EdgeByTheNumbers | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadEdge() {
      setLoading(true);
      const [sl, tl, btn] = await Promise.allSettled([
        fetchEdgeSkaterLanding(),
        fetchEdgeTeamLanding(),
        fetchEdgeByTheNumbers(),
      ]);
      if (sl.status === 'fulfilled') setSkaterLanding(sl.value);
      if (tl.status === 'fulfilled') setTeamLanding(tl.value);
      if (btn.status === 'fulfilled') setByTheNumbers(btn.value);
      setLoading(false);
    }
    loadEdge();
  }, []);

  if (loading) {
    return (
      <View style={localStyles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={localStyles.factorsContainer} testID="edge-content">
      {/* Season Leaders */}
      <View style={{ paddingHorizontal: 0, marginBottom: 12 }}>
        <Text style={localStyles.tooltipsSectionTitle}>Season Leaders</Text>
        <View style={{ width: 32, height: 2, backgroundColor: theme.accent, borderRadius: 1, marginTop: 4, opacity: 0.6 }} />
      </View>
      <View style={{ gap: 12, marginBottom: 24 }}>
        {skaterLanding?.hardestShot && (
          <View style={localStyles.edgeLeaderCard}>
            <Text style={localStyles.edgeLeaderLabel}>Hardest Shot</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Text style={localStyles.edgeLeaderValue}>
                {skaterLanding.hardestShot.shotSpeed?.imperial?.speed?.toFixed(0)} mph
              </Text>
              <Text style={localStyles.edgeLeaderName}>
                {skaterLanding.hardestShot.player?.lastName?.default}
              </Text>
            </View>
          </View>
        )}
        {skaterLanding?.maxSkatingSpeed && (
          <View style={localStyles.edgeLeaderCard}>
            <Text style={localStyles.edgeLeaderLabel}>Fastest Skater</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Text style={localStyles.edgeLeaderValue}>
                {skaterLanding.maxSkatingSpeed.skatingSpeed?.imperial?.speed?.toFixed(1)} mph
              </Text>
              <Text style={localStyles.edgeLeaderName}>
                {skaterLanding.maxSkatingSpeed.player?.lastName?.default}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Last Game Night */}
      {byTheNumbers && (
        <>
          <View style={{ paddingHorizontal: 0, marginBottom: 12 }}>
            <Text style={localStyles.tooltipsSectionTitle}>Last Game Night</Text>
            <View style={{ width: 32, height: 2, backgroundColor: theme.accent, borderRadius: 1, marginTop: 4, opacity: 0.6 }} />
          </View>
          <Text style={localStyles.tooltipsSectionSubtitle}>{byTheNumbers.gameDate}</Text>
          <View style={{ gap: 12, marginBottom: 24 }}>
            {byTheNumbers.hardestShotSkater && (
              <View style={localStyles.edgeLeaderCard}>
                <Text style={localStyles.edgeLeaderLabel}>Hardest Shot</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                  <Text style={localStyles.edgeLeaderValue}>
                    {byTheNumbers.hardestShotSkater.shotSpeed?.imperial?.speed?.toFixed(1)} mph
                  </Text>
                  <Text style={localStyles.edgeLeaderName}>
                    {byTheNumbers.hardestShotSkater.player?.lastName?.default}
                  </Text>
                </View>
              </View>
            )}
            {byTheNumbers.maxSkatingSpeedSkater && (
              <View style={localStyles.edgeLeaderCard}>
                <Text style={localStyles.edgeLeaderLabel}>Fastest Skater</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                  <Text style={localStyles.edgeLeaderValue}>
                    {byTheNumbers.maxSkatingSpeedSkater.skatingSpeed?.imperial?.speed?.toFixed(1)} mph
                  </Text>
                  <Text style={localStyles.edgeLeaderName}>
                    {byTheNumbers.maxSkatingSpeedSkater.player?.lastName?.default}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </>
      )}

      {/* Team Edge Rankings */}
      {teamLanding && (
        <>
          <View style={{ paddingHorizontal: 0, marginBottom: 12 }}>
            <Text style={localStyles.tooltipsSectionTitle}>Team Edge Rankings</Text>
            <View style={{ width: 32, height: 2, backgroundColor: theme.accent, borderRadius: 1, marginTop: 4, opacity: 0.6 }} />
          </View>
          <View style={{ gap: 12, marginBottom: 24 }}>
            {teamLanding.shotAttemptsOver90 && (
              <View style={localStyles.edgeLeaderCard}>
                <Text style={localStyles.edgeLeaderLabel}>Most Shots &gt;90mph</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                  <Text style={localStyles.edgeLeaderValue}>
                    {teamLanding.shotAttemptsOver90.value}
                  </Text>
                  <Text style={localStyles.edgeLeaderName}>
                    #{teamLanding.shotAttemptsOver90.team?.abbrev}
                  </Text>
                </View>
              </View>
            )}
            {teamLanding.burstsOver22 && (
              <View style={localStyles.edgeLeaderCard}>
                <Text style={localStyles.edgeLeaderLabel}>Speed Bursts &gt;22mph</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                  <Text style={localStyles.edgeLeaderValue}>
                    {teamLanding.burstsOver22.value}
                  </Text>
                  <Text style={localStyles.edgeLeaderName}>
                    #{teamLanding.burstsOver22.team?.abbrev}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </>
      )}

      {!skaterLanding && !teamLanding && !byTheNumbers && (
        <View style={{ alignItems: 'center', paddingTop: 40 }}>
          <Text style={{ color: theme.subtext, fontSize: 14 }}>Edge data unavailable</Text>
        </View>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// Factors content with tooltips + comparison
function FactorsContent() {
  const [tooltipStat, setTooltipStat] = useState<string>('');

  return (
    <ScrollView style={localStyles.factorsContainer}>
      <FactorLeaderboard />

      {/* Stat Tooltips Section */}
      <View style={localStyles.tooltipsSection}>
        <View style={{ marginBottom: 4 }}>
          <Text style={localStyles.tooltipsSectionTitle}>Advanced Stats Guide</Text>
          <View style={{ width: 32, height: 2, backgroundColor: theme.accent, borderRadius: 1, marginTop: 4, opacity: 0.6 }} />
        </View>
        <Text style={localStyles.tooltipsSectionSubtitle}>Tap any stat to learn more</Text>
        <View style={localStyles.statChips}>
          {Object.keys(STAT_TOOLTIPS).map((stat) => (
            <TouchableOpacity
              key={stat}
              style={localStyles.statChip}
              onPress={() => setTooltipStat(stat)}
            >
              <Text style={localStyles.statChipText}>{stat}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <StatTooltip
        visible={!!tooltipStat}
        stat={tooltipStat}
        onClose={() => setTooltipStat('')}
      />

      {/* Team Comparison Tool */}
      <TeamComparisonTool />

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

export default function ExploreScreen() {
  const [activeSegment, setActiveSegment] = useState<Segment>('teams');
  const analytics = useAnalytics('Explore');

  const handleSegmentChange = (segment: Segment) => {
    setActiveSegment(segment);
    analytics.trackCustomEvent('explore_tab_changed', { segment });
  };

  const renderLoadingFallback = () => (
    <View style={localStyles.loadingContainer}>
      <ActivityIndicator size="large" color={theme.accent} />
    </View>
  );

  const renderContent = () => {
    switch (activeSegment) {
      case 'teams':
        return (
          <Suspense fallback={renderLoadingFallback()}>
            <TeamsContent embedded />
          </Suspense>
        );
      case 'edge':
        return <EdgeContent />;
      case 'factors':
        return <FactorsContent />;
      case 'models':
        return (
          <Suspense fallback={renderLoadingFallback()}>
            <ModelsContent />
          </Suspense>
        );
      default:
        return null;
    }
  };

  return (
    <ThemedView style={localStyles.container} testID="explore-tab">
      <View style={localStyles.header}>
        <Text style={localStyles.title}>Explore</Text>
        <Text style={localStyles.subtitle}>Teams, analytics, and models</Text>
      </View>

      <View style={localStyles.segmentControl}>
        {SEGMENTS.map((segment) => {
          const isActive = activeSegment === segment.key;
          return (
            <TouchableOpacity
              key={segment.key}
              testID={segment.testID}
              style={[
                localStyles.segmentButton,
                isActive && localStyles.segmentButtonActive,
              ]}
              onPress={() => handleSegmentChange(segment.key)}
            >
              <Text
                style={[
                  localStyles.segmentText,
                  isActive && localStyles.segmentTextActive,
                ]}
              >
                {segment.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={localStyles.content}>{renderContent()}</View>
    </ThemedView>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    paddingTop: 0,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 30,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.text,
  },
  subtitle: {
    fontSize: 14,
    color: theme.subtext,
    marginTop: 4,
  },
  segmentControl: {
    flexDirection: 'row',
    backgroundColor: theme.card,
    borderRadius: 10,
    marginHorizontal: 16,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  segmentButtonActive: {
    backgroundColor: theme.accent,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.subtext,
  },
  segmentTextActive: {
    color: theme.text,
  },
  content: {
    flex: 1,
    marginTop: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  factorsContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  // Stat Tooltips
  tooltipsSection: {
    marginTop: 24,
  },
  tooltipsSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.accent,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  tooltipsSectionSubtitle: {
    fontSize: 13,
    color: theme.subtext,
    marginBottom: 12,
  },
  statChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statChip: {
    backgroundColor: theme.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  statChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.accent,
  },
  tooltipOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  tooltipContainer: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 40,
    maxWidth: 320,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  tooltipTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 8,
  },
  tooltipText: {
    fontSize: 14,
    color: theme.subtext,
    lineHeight: 22,
    marginBottom: 16,
  },
  tooltipClose: {
    alignSelf: 'flex-end',
    backgroundColor: theme.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tooltipCloseText: {
    color: theme.text,
    fontWeight: '600',
    fontSize: 14,
  },
  // Team Comparison
  comparisonContainer: {
    marginTop: 32,
  },
  comparisonTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.accent,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  comparisonSubtitle: {
    fontSize: 13,
    color: theme.subtext,
    marginBottom: 16,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  teamPickerButton: {
    backgroundColor: theme.card,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    minWidth: 100,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  teamPickerText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text,
  },
  vsText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.subtext,
  },
  pickerContainer: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 40,
    maxWidth: 300,
    maxHeight: 500,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  pickerItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  pickerItemActive: {
    backgroundColor: theme.accent,
  },
  pickerItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    textAlign: 'center',
  },
  pickerItemTextActive: {
    color: theme.text,
  },
  resultsContainer: {
    marginTop: 20,
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  categoryWinner: {
    fontSize: 14,
    fontWeight: '700',
  },
  // Edge content
  edgeLeaderCard: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  edgeLeaderLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.subtext,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  edgeLeaderValue: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.text,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontVariant: ['tabular-nums'] as any,
  },
  edgeLeaderName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.accent,
  },
});
