/**
 * Player detail sheet: who he is, this week's games, season + recent form, game log,
 * and the roster actions that make sense from where it was opened.
 */

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { FantasyPlayer, SlotPosition } from '../../types/fantasy';
import { usePlayerDetail } from '../../hooks/usePlayerDetail';
import { useNhlToday, useWeekSchedule } from '../../hooks/useCoach';
import { TREND_LABEL, type PlayerForm } from '../../services/fantasy/form';
import { basePositions, isGoalie, normalizePosition, positionLabel } from '../../services/fantasy/positions';
import { DEFAULT_SCORING, formatValue, goaliePoints, skaterPoints } from '../../services/fantasy/scoring';
import { addPlayers, hidePickup, removePlayer, updatePlayer } from '../../services/teams';
import { mondayOf, seasonIdFor, seasonLabel, shortDate } from '../../services/nhl/dates';
import { fetchPlayerEdge } from '../../services/nhl/edge';
import { useResource } from '../../hooks/useResource';
import { EdgePanel } from '../coach/EdgePanel';
import { fantasyGamesOn, gameForTeam, isOffNight, opponentOf } from '../../services/nhl/schedule';
import type { GameLogRow } from '../../services/nhl/player';
import type { GoalieLine, SkaterLine } from '../../services/nhl/stats';
import { useTeams } from '../TeamsProvider';
import { useSubscription } from '../SubscriptionProvider';
import { usePaywall } from '../PaywallProvider';
import type { PaywallSource } from '../../constants/monetization';
import { splitName } from '../coach/PlayerAvatar';
import { Image } from 'expo-image';
import { teamTile } from '../../constants/teamTiles';
import { USE_NHL_HEADSHOTS } from '../../constants/legal';
import { Card, colors, display, ErrorBanner, GhostButton, LoadingRows, Pill, PrimaryButton, ProLockCard, SectionLabel, StatCell, useWide } from '../coach/ui';
import { track } from '../../services/analytics/track';

export type PlayerSheetContext = 'roster' | 'opponent' | 'pickup' | 'browse';

interface OpenArgs {
  playerId: number;
  context: PlayerSheetContext;
}

interface PlayerSheetContextValue {
  openPlayer: (playerId: number, context?: PlayerSheetContext) => void;
}

const SheetContext = createContext<PlayerSheetContextValue | undefined>(undefined);

export function PlayerSheetProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<OpenArgs | null>(null);
  const { openPaywall } = usePaywall();
  // iOS can't present the paywall modal over this sheet, so close the sheet first and
  // open the paywall once it has finished dismissing.
  const pendingPaywall = useRef<PaywallSource | null>(null);
  const upsell = useCallback((source: PaywallSource) => {
    if (Platform.OS === 'ios') {
      pendingPaywall.current = source;
      setOpen(null);
    } else {
      setOpen(null);
      openPaywall(source);
    }
  }, [openPaywall]);
  const handleDismiss = useCallback(() => {
    const source = pendingPaywall.current;
    pendingPaywall.current = null;
    if (source) openPaywall(source);
  }, [openPaywall]);
  const openPlayer = useCallback((playerId: number, context: PlayerSheetContext = 'browse') => {
    track('player_open', { context });
    setOpen({ playerId, context });
  }, []);
  const value = useMemo(() => ({ openPlayer }), [openPlayer]);
  return (
    <SheetContext.Provider value={value}>
      {children}
      <Modal
        visible={open !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(null)}
        onDismiss={handleDismiss}
      >
        {open ? <PlayerSheetBody {...open} onClose={() => setOpen(null)} onUpsell={upsell} /> : null}
      </Modal>
    </SheetContext.Provider>
  );
}

export function usePlayerSheet(): PlayerSheetContextValue {
  const value = useContext(SheetContext);
  if (!value) throw new Error('usePlayerSheet must be used within a PlayerSheetProvider');
  return value;
}

const FREE_LOG_ROWS = 5;
const EDITABLE_POSITIONS: SlotPosition[] = ['C', 'LW', 'RW', 'D'];

function formLine(form: PlayerForm | null): string {
  if (!form) return '—';
  return `${formatValue(form.seasonRate)} ${form.isGoalie ? 'per start' : 'per game'}`;
}

function SeasonStats({ form }: { form: PlayerForm }) {
  const line = form.season;
  if (!line) return <Text style={styles.muted}>No NHL games yet.</Text>;
  if ('gs' in line) {
    const g = line as GoalieLine;
    return (
      <View style={styles.statRow}>
        <StatCell size={22} value={String(g.gs)} label="GS" />
        <StatCell size={22} value={String(g.wins)} label="W" />
        <StatCell size={22} value={g.savePct ? g.savePct.toFixed(3).replace(/^0/, '') : '—'} label="SV%" />
        <StatCell size={22} value={g.gaa ? g.gaa.toFixed(2) : '—'} label="GAA" />
        <StatCell size={22} value={String(g.shutouts)} label="SO" />
      </View>
    );
  }
  const s = line as SkaterLine;
  return (
    <View style={styles.statRow}>
      <StatCell size={22} value={String(s.gp)} label="GP" />
      <StatCell size={22} value={String(s.goals)} label="G" />
      <StatCell size={22} value={String(s.assists)} label="A" />
      <StatCell size={22} value={String(s.ppp)} label="PPP" />
      <StatCell size={22} value={String(s.shots)} label="SOG" />
      <StatCell size={22} value={String(s.hits)} label="HIT" />
    </View>
  );
}

function LogRow({ row, goalie, fp }: { row: GameLogRow; goalie: boolean; fp: number }) {
  return (
    <View style={styles.logRow}>
      <Text style={[styles.logCell, styles.logDate]}>{shortDate(row.date)}</Text>
      <Text style={[styles.logCell, styles.logOpp]}>{row.isHome ? 'vs' : '@'} {row.opponent}</Text>
      {goalie ? (
        <>
          <Text style={styles.logCell}>{row.decision ?? (row.started ? 'ND' : '—')}</Text>
          <Text style={styles.logCell}>{row.shotsAgainst}</Text>
          <Text style={styles.logCell}>{row.goalsAgainst}</Text>
        </>
      ) : (
        <>
          <Text style={styles.logCell}>{row.goals}</Text>
          <Text style={styles.logCell}>{row.assists}</Text>
          <Text style={styles.logCell}>{row.shots}</Text>
        </>
      )}
      <Text style={[styles.logCell, styles.logFp]}>{formatValue(fp)}</Text>
    </View>
  );
}

function ValueBars({ rows, values, color }: { rows: GameLogRow[]; values: number[]; color: string }) {
  const max = Math.max(1, ...values);
  return (
    <View style={styles.bars}>
      {rows.map((row, index) => {
        const value = values[index];
        const height = Math.max(4, (Math.max(0, value) / max) * 96);
        return (
          <View key={row.gameId || row.date} style={styles.barCol}>
            <Text style={styles.barValue}>{formatValue(value)}</Text>
            <View style={[styles.bar, { height, backgroundColor: value > 0 ? color : colors.raised }]} />
            <Text style={styles.barLabel}>{row.opponent}</Text>
          </View>
        );
      })}
    </View>
  );
}

function PlayerSheetBody({ playerId, context, onClose, onUpsell }: OpenArgs & { onClose: () => void; onUpsell: (source: PaywallSource) => void }) {
  const wide = useWide();
  const { team, updateTeam } = useTeams();
  const { isPremium } = useSubscription();
  const scoring = team?.scoring ?? DEFAULT_SCORING;
  const detail = usePlayerDetail(playerId, scoring);
  const today = useNhlToday();
  const schedule = useWeekSchedule(mondayOf(today));

  const rosterPlayer = team?.players.find((player) => player.playerId === playerId) ?? null;
  const onOpponent = team?.opponent.some((player) => player.playerId === playerId) ?? false;
  const profile = detail.data?.profile;
  const form = detail.data?.form ?? null;
  const goalie = profile ? normalizePosition(profile.position) === 'G' : false;
  const edgeSeason = seasonIdFor(today);
  const edge = useResource(
    profile ? `edge:${playerId}:${goalie ? 'g' : 's'}:${edgeSeason}` : null,
    (force) => fetchPlayerEdge(playerId, goalie, edgeSeason, { force }),
  );

  const weekGames = useMemo(() => {
    if (!profile?.team || !schedule.data) return [];
    return schedule.data.days.map((day) => {
      const game = gameForTeam(fantasyGamesOn(day), profile.team);
      return {
        date: day.date,
        dayAbbrev: day.dayAbbrev,
        game: game ? opponentOf(game, profile.team) : null,
        offNight: isOffNight(day),
        past: day.date < today,
      };
    });
  }, [profile?.team, schedule.data, today]);

  const asFantasyPlayer = (): FantasyPlayer | null => profile
    ? { playerId, playerName: profile.name, teamAbbrev: profile.team, position: profile.position, rosterPosition: 'BN' }
    : null;

  const handleAdd = (list: 'players' | 'opponent') => {
    const player = asFantasyPlayer();
    if (!player || !team) return;
    updateTeam((current) => addPlayers(current, [player], list));
    onClose();
  };

  const handleRemove = (list: 'players' | 'opponent') => {
    if (!profile) return;
    Alert.alert(`Remove ${profile.name}?`, list === 'players' ? 'He’ll come off your PuckIQ roster.' : 'He’ll come off your opponent’s roster.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          updateTeam((current) => removePlayer(current, playerId, list));
          onClose();
        },
      },
    ]);
  };

  const toggleEligible = (pos: SlotPosition) => {
    if (!rosterPlayer) return;
    const current = basePositions(rosterPlayer);
    const next = current.includes(pos) ? current.filter((value) => value !== pos) : [...current, pos];
    if (next.length === 0) return;
    updateTeam((teamState) => updatePlayer(teamState, playerId, { eligible: next }));
  };

  const toggleIr = () => {
    if (!rosterPlayer) return;
    updateTeam((teamState) => updatePlayer(teamState, playerId, { injuredReserve: !rosterPlayer.injuredReserve }));
  };

  const logRows = detail.data?.log?.games ?? [];
  // Pro gets the whole season's log, as the paywall promises.
  const visibleLog = isPremium ? logRows : logRows.slice(0, FREE_LOG_ROWS);

  const fpFor = (row: GameLogRow) => (goalie
    ? goaliePoints({ wins: row.decision === 'W' ? 1 : 0, saves: row.saves, goalsAgainst: row.goalsAgainst, shutouts: row.shutout ? 1 : 0 }, scoring)
    : skaterPoints({ goals: row.goals, assists: row.assists, ppp: row.ppp, shots: row.shots, plusMinus: row.plusMinus }, scoring));

  const tile = teamTile(profile?.team);
  const names = splitName(profile?.name ?? '');
  const chartRows = [...logRows].slice(0, isPremium ? 10 : 5).reverse();

  return (
    <View style={styles.container} testID="player-sheet">
      <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
        {!profile ? (
          <View style={styles.loadingWrap}>
            <View style={styles.header}>
              <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close" testID="player-sheet-close">
                <Ionicons name="close" size={24} color={colors.sub} />
              </Pressable>
            </View>
            {detail.loading ? <LoadingRows count={5} /> : null}
            {detail.error ? <ErrorBanner message="Couldn’t load this player." onRetry={detail.refresh} /> : null}
          </View>
        ) : null}

        {profile ? (
          <>
            <View style={[styles.heroPanel, { backgroundColor: tile.tile }]}>
              <View style={styles.heroTop}>
                <Text style={[styles.heroTeam, { color: tile.on }]} numberOfLines={1}>{(profile.teamName || profile.team).toUpperCase()}</Text>
                <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close" testID="player-sheet-close" style={styles.closeButton}>
                  <Ionicons name="close" size={20} color={colors.ink} />
                </Pressable>
              </View>
              <View style={styles.heroMain}>
                <View style={styles.heroNames}>
                  {names.first ? <Text style={[styles.heroFirst, { color: tile.on }]}>{names.first}</Text> : null}
                  <Text style={[styles.heroLast, { color: tile.on }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                    {names.last.toUpperCase()}
                  </Text>
                  <Text style={[styles.heroMeta, { color: tile.on }]}>
                    {[
                      profile.sweaterNumber != null ? `#${profile.sweaterNumber}` : null,
                      rosterPlayer ? positionLabel(rosterPlayer) : positionLabel({ position: profile.position }),
                      profile.age != null ? `${profile.age} yrs` : null,
                    ].filter(Boolean).join('  ·  ')}
                  </Text>
                  {rosterPlayer?.injuredReserve ? <Pill label="ON IR" tone="warn" solid /> : null}
                </View>
                {profile.headshot && USE_NHL_HEADSHOTS ? (
                  <Image
                    source={{ uri: profile.headshot }}
                    style={[styles.heroImage, wide && styles.heroImageWide]}
                    contentFit="contain"
                    contentPosition="bottom"
                    transition={150}
                  />
                ) : null}
              </View>
            </View>

            <View style={styles.body}>
              <View style={styles.bigStats}>
                <View style={styles.bigStat}>
                  <Text style={styles.bigValue}>{form ? formatValue(form.value) : '—'}</Text>
                  <Text style={styles.bigLabel}>{goalie ? 'VALUE / TEAM GAME' : 'VALUE / GAME'}</Text>
                </View>
                <View style={styles.bigStat}>
                  <Text style={styles.bigValue}>{form?.season ? String('gs' in form.season ? form.season.gs : form.season.gp) : '—'}</Text>
                  <Text style={styles.bigLabel}>{goalie ? 'STARTS' : 'GP'}</Text>
                </View>
                <View style={styles.bigStat}>
                  <Text style={styles.bigValue}>
                    {form?.season ? ('gs' in form.season ? String(form.season.wins) : String(form.season.points)) : '—'}
                  </Text>
                  <Text style={styles.bigLabel}>{goalie ? 'WINS' : 'PTS'}</Text>
                </View>
              </View>
              {form?.basis === 'previous' ? <Text style={styles.basisNote}>Last season’s numbers until he plays this season.</Text> : null}

              <View style={styles.actions}>
                {context === 'roster' || rosterPlayer ? (
                  <GhostButton label="Remove" icon="remove" tone="bad" onPress={() => handleRemove('players')} testID="player-remove" />
                ) : context === 'opponent' || onOpponent ? (
                  <GhostButton label="Remove from opponent" icon="remove" tone="bad" onPress={() => handleRemove('opponent')} />
                ) : (
                  <PrimaryButton label="Add to my team" icon="add" onPress={() => handleAdd('players')} testID="player-add" style={styles.addButton} />
                )}
                {context === 'pickup' && team ? (
                  <GhostButton
                    label="Already taken"
                    icon="eye-off-outline"
                    tone="ink"
                    onPress={() => {
                      updateTeam((current) => hidePickup(current, playerId));
                      onClose();
                    }}
                    testID="player-hide"
                  />
                ) : null}
              </View>

            <SectionLabel title="This week" />
            <View style={styles.weekRow}>
              {weekGames.map((day) => (
                <View key={day.date} style={[styles.weekDay, day.past && styles.weekDayPast]}>
                  <Text style={[styles.weekAbbrev, day.offNight && styles.offNight]}>{day.dayAbbrev.slice(0, 2)}</Text>
                  {day.game ? (
                    <Text style={styles.weekOpp}>{day.game.isHome ? '' : '@'}{day.game.opponent}</Text>
                  ) : (
                    <Text style={styles.weekNone}>—</Text>
                  )}
                </View>
              ))}
            </View>

            <SectionLabel
              title={detail.data?.form?.basis === 'previous' && detail.data?.form.season ? `Last season` : 'Season'}
              right={form ? <Text style={styles.value}>{formLine(form)}</Text> : null}
            />
            <Card>{form ? <SeasonStats form={form} /> : <Text style={styles.muted}>No NHL stats yet.</Text>}</Card>

            {edge.loading || edge.data ? (
              <>
                <SectionLabel title="Telemetry" right={!isPremium ? <Pill label="PRO" tone="accent" /> : null} />
                <EdgePanel edge={edge.data} loading={edge.loading} isPro={isPremium} onUnlock={() => onUpsell('player_edge')} />
              </>
            ) : null}

            <SectionLabel title="Last 14 days" right={!isPremium ? <Pill label="PRO" tone="accent" /> : null} />
            {isPremium ? (
              <Card>
                {form && form.recentRate !== null ? (
                  <View style={styles.statRow}>
                    <StatCell value={String(form.recentGp)} label={goalie ? 'Starts' : 'Games'} />
                    <StatCell value={formatValue(form.recentRate)} label={goalie ? 'Value / start' : 'Value / game'} />
                    <StatCell
                      value={TREND_LABEL[form.trend]}
                      label="Trend"
                      tone={form.trend === 'hot' ? 'good' : form.trend === 'cold' ? 'bad' : 'neutral'}
                    />
                    {goalie ? <StatCell value={`${Math.round(form.startShare * 100)}%`} label="Start share" /> : null}
                  </View>
                ) : (
                  <Text style={styles.muted}>No NHL games in the last 14 days.</Text>
                )}
              </Card>
            ) : (
              <ProLockCard
                title="Recent form & trend"
                detail="Last-14-day value, hot/cold trend, and goalie start share."
                onPress={() => onUpsell('player_trends')}
              />
            )}

            {chartRows.length > 0 ? (
              <>
                <SectionLabel title={`Last ${chartRows.length} games`} right={<Text style={styles.value}>fantasy value</Text>} />
                <Card>
                  <ValueBars rows={chartRows} values={chartRows.map(fpFor)} color={tile.tile} />
                </Card>
              </>
            ) : null}

            <SectionLabel
              title={detail.data?.logIsPrevious && detail.data.log ? `Game log · ${seasonLabel(detail.data.log.seasonId)}` : 'Game log'}
            />
            <Card style={styles.logCard}>
              <View style={[styles.logRow, styles.logHeader]}>
                <Text style={[styles.logHead, styles.logDate]}>DATE</Text>
                <Text style={[styles.logHead, styles.logOpp]}>OPP</Text>
                {goalie ? (
                  <>
                    <Text style={styles.logHead}>DEC</Text>
                    <Text style={styles.logHead}>SA</Text>
                    <Text style={styles.logHead}>GA</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.logHead}>G</Text>
                    <Text style={styles.logHead}>A</Text>
                    <Text style={styles.logHead}>SOG</Text>
                  </>
                )}
                <Text style={[styles.logHead, styles.logFp]}>VAL</Text>
              </View>
              {visibleLog.length === 0 ? <Text style={[styles.muted, styles.logEmpty]}>No games logged.</Text> : null}
              {visibleLog.map((row) => (
                <LogRow key={row.gameId || row.date} row={row} goalie={goalie} fp={fpFor(row)} />
              ))}
            </Card>
            {!isPremium && logRows.length > FREE_LOG_ROWS ? (
              <Pressable onPress={() => onUpsell('player_trends')} style={styles.moreLog}>
                <Text style={styles.moreLogText}>See all {logRows.length} games with Pro</Text>
              </Pressable>
            ) : null}

            {detail.data && detail.data.news.length > 0 ? (
              <>
                <SectionLabel title="In the news" />
                <Card style={styles.newsCard}>
                  {detail.data.news.map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() => Linking.openURL(item.url)}
                      style={({ pressed }) => [styles.newsRow, pressed && styles.pressed]}
                      accessibilityRole="link"
                      testID="player-news-item"
                    >
                      <Text style={styles.newsTitle}>{item.title}</Text>
                      <Text style={styles.newsMeta}>ESPN{item.publishedAt ? ` · ${new Date(item.publishedAt).toLocaleDateString()}` : ''} ↗</Text>
                    </Pressable>
                  ))}
                </Card>
              </>
            ) : null}

            {rosterPlayer && !isGoalie(rosterPlayer) ? (
              <>
                <SectionLabel title="League eligibility" />
                <Card>
                  <Text style={styles.help}>Match your league (e.g. Yahoo C/LW). Used for lineup slots.</Text>
                  <View style={styles.chips}>
                    {EDITABLE_POSITIONS.map((pos) => {
                      const on = basePositions(rosterPlayer).includes(pos);
                      return (
                        <Pressable
                          key={pos}
                          onPress={() => toggleEligible(pos)}
                          style={[styles.chip, on && styles.chipOn]}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: on }}
                          accessibilityLabel={`Eligible at ${pos}`}
                          testID={`eligible-${pos}`}
                        >
                          <Text style={[styles.chipText, on && styles.chipTextOn]}>{pos}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </Card>
              </>
            ) : null}

            {rosterPlayer ? (
              <Card style={styles.irCard} onPress={toggleIr} testID="player-ir-toggle">
                <Ionicons name={rosterPlayer.injuredReserve ? 'checkbox' : 'square-outline'} size={20} color={colors.accent} />
                <View style={styles.irText}>
                  <Text style={styles.irTitle}>On my league’s IR</Text>
                  <Text style={styles.help}>IR players never count toward lineups or games.</Text>
                </View>
              </Card>
            ) : null}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollBody: {
    paddingBottom: 48,
  },
  loadingWrap: {
    paddingHorizontal: 18,
  },
  heroPanel: {
    paddingTop: 18,
    paddingHorizontal: 18,
    overflow: 'hidden',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTeam: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    opacity: 0.85,
    flex: 1,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMain: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: 190,
  },
  heroNames: {
    flex: 1,
    paddingBottom: 22,
    gap: 2,
  },
  heroFirst: {
    fontSize: 22,
    fontWeight: '400',
  },
  heroLast: {
    ...display(40),
    letterSpacing: -1,
  },
  heroMeta: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 6,
    marginBottom: 6,
  },
  heroImage: {
    width: 180,
    height: 190,
    marginRight: -18,
  },
  heroImageWide: {
    width: 260,
    height: 250,
    marginRight: 24,
  },
  bigStats: {
    flexDirection: 'row',
    marginTop: 18,
  },
  bigStat: {
    flex: 1,
  },
  bigValue: {
    ...display(38),
  },
  bigLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: colors.muted,
  },
  basisNote: {
    fontSize: 12,
    color: colors.warn,
    fontWeight: '700',
    marginTop: 6,
  },
  addButton: {
    flex: 1,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 140,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  bar: {
    width: '100%',
    borderRadius: 6,
  },
  barValue: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.text,
  },
  barLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.muted,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  body: {
    paddingHorizontal: 18,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  meta: {
    fontSize: 13,
    color: colors.sub,
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  weekRow: {
    flexDirection: 'row',
    gap: 4,
  },
  weekDay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.card,
    gap: 3,
  },
  weekDayPast: {
    opacity: 0.45,
  },
  weekAbbrev: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.muted,
    letterSpacing: 0.8,
  },
  offNight: {
    color: colors.accent,
  },
  weekOpp: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  weekNone: {
    fontSize: 11,
    color: colors.muted,
  },
  value: {
    fontSize: 12,
    color: colors.sub,
    fontWeight: '700',
  },
  statRow: {
    flexDirection: 'row',
    gap: 6,
  },
  muted: {
    fontSize: 13,
    color: colors.muted,
  },
  logCard: {
    paddingVertical: 6,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  logHeader: {
    paddingTop: 4,
  },
  logHead: {
    flex: 1,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    color: colors.muted,
    textAlign: 'center',
  },
  logCell: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    textAlign: 'center',
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  logDate: {
    flex: 1.4,
    textAlign: 'left',
  },
  logOpp: {
    flex: 1.4,
    textAlign: 'left',
  },
  logFp: {
    color: colors.text,
    fontWeight: '900',
  },
  logEmpty: {
    paddingVertical: 12,
  },
  moreLog: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  moreLogText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  newsCard: {
    paddingVertical: 4,
  },
  newsRow: {
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 3,
  },
  pressed: {
    opacity: 0.7,
  },
  newsTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
    color: colors.text,
  },
  newsMeta: {
    fontSize: 11,
    color: colors.muted,
  },
  help: {
    fontSize: 12,
    color: colors.sub,
    lineHeight: 17,
  },
  chips: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  chip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  chipOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.sub,
  },
  chipTextOn: {
    color: colors.onAccent,
  },
  irCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  irText: {
    flex: 1,
  },
  irTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
});
