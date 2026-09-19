import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useArena } from './ArenaProvider';
import { ArenaButton, arenaType } from './ArenaPrimitives';
import { ArenaHeadline } from './ArenaHeadline';
import { ArenaSkater } from './ArenaSkater';
import { formatSeasonLabel } from '../../utils/season';
import type { SeasonPhase } from '../../utils/seasonContext';

const PHASES: { key: SeasonPhase; label: string; title: string; copy: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'offseason', label: 'Offseason', title: 'Build your next season.', copy: 'Choose your teams, watch the players you care about and revisit the cards you saved.', icon: 'shirt-outline' },
  { key: 'preseason', label: 'Preseason', title: 'Get your watchlist ready.', copy: 'Explore exhibition matchups and player baselines. Preseason results stay separate from the regular season.', icon: 'clipboard-outline' },
  { key: 'regular', label: 'Season', title: 'Know what changed before puck drop.', copy: 'Open your matchup, compare the teams and save the pregame forecast. Come back for the result.', icon: 'ticket-outline' },
  { key: 'playoffs', label: 'Playoffs', title: 'Every game changes the series.', copy: 'Follow the known series results, revisit each matchup and keep your predictions in the season book.', icon: 'trophy-outline' },
];

export function SeasonIdentity({ phase, label, note, estimated }: { phase: SeasonPhase; label: string; note: string; estimated: boolean }) {
  const { palette: p } = useArena();
  return <View style={{ marginBottom: 15 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
      <Ionicons name={PHASES.find(item => item.key === phase)?.icon} size={18} color={p.link} />
      <Text style={[styles.body, { fontWeight: '800', color: p.ink, fontSize: 14 }]}>{label}</Text>
      {estimated && <Text style={[styles.body, { color: p.muted, fontSize: 10 }]}>Calendar estimate</Text>}
    </View>
    <Text style={[styles.body, { color: p.muted, fontSize: 11, lineHeight: 16, marginTop: 4 }]}>{note}</Text>
  </View>;
}

function ClubJersey() {
  const { palette: p, homeTeam } = useArena();
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 202, height: 265 }}>
    <Svg width="202" height="265" viewBox="0 0 220 290">
      <Path d="M111 14 C90 4 98 -3 109 0 C126 2 122 19 111 24 L111 36 M111 36 L39 70 Q32 74 40 77 L181 77 Q189 74 181 70 Z" stroke={p.frame} strokeWidth="6" fill="none" />
      <Path d="M76 58 L49 69 L8 130 L40 153 L65 123 L56 258 Q108 273 166 258 L158 123 L181 153 L215 130 L173 69 L143 58 Q110 88 76 58Z" fill={p.paper} stroke={p.frame} strokeWidth="5" strokeLinejoin="round" />
      <Path d="M76 58 Q110 88 143 58 L137 80 Q110 100 82 80 Z" fill={p.action} stroke={p.frame} strokeWidth="3" />
      <Path d="M60 219 L164 219 L166 242 L58 242 Z M21 112 L48 132 L40 145 L13 125 Z M174 132 L201 112 L211 125 L182 145 Z" fill={p.hero} />
      <Path d="M59 210 L164 210 M59 249 L165 249" stroke={p.action} strokeWidth="7" />
      <Circle cx="111" cy="151" r="36" fill={p.hero} stroke={p.frame} strokeWidth="3" />
      <Path d="M89 130 L128 172 L142 165 M133 130 L94 172 L80 165" stroke={p.heroInk} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
    <Text style={{ position: 'absolute', bottom: 22, alignSelf: 'center', fontFamily: arenaType.display, fontSize: 25, color: p.ink }}>{homeTeam?.abbrev ?? 'PUCKIQ'}</Text>
  </View>;
}

export function SeasonClubhouse({ phase, season, onBook }: { phase: 'offseason' | 'preseason'; season: number; onBook: () => void }) {
  const { palette: p, homeTeam } = useArena();
  const { width } = useWindowDimensions();
  const camp = phase === 'preseason';
  return <View style={{ marginBottom: 15 }}>
    <View style={{ borderWidth: 2, borderColor: p.frame, borderRadius: 19, backgroundColor: p.hero, overflow: 'hidden' }}>
      <View style={{ minHeight: 355 }}>
        <Svg pointerEvents="none" accessible={false} style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Circle cx="285" cy="183" r="143" fill={p.action} opacity={0.8} />
          {[55, 85, 115, 145, 175, 205, 235, 265, 295].map(y => <Line key={y} x1="0" x2="500" y1={y} y2={y - 65} stroke={p.heroInk} opacity={0.12} strokeWidth="2" />)}
          {camp && <Path d="M255 315 Q95 305 198 228 Q301 170 239 126" stroke={p.heroInk} strokeWidth="3" strokeDasharray="7 7" fill="none" />}
        </Svg>
        <Text style={[styles.body, { color: p.heroInk, fontSize: 11, fontWeight: '700', padding: 20 }]}>{formatSeasonLabel(season)} / {homeTeam?.shortName ?? 'Your club'}</Text>
        <View style={{ position: 'absolute', right: camp ? -49 : -18, top: camp ? 80 : 90, transform: [{ rotate: camp ? '0deg' : '12deg' }] }}>
          {camp ? <ArenaSkater style={{ width: 260, height: 318 }} /> : <ClubJersey />}
        </View>
        <ArenaHeadline text={camp ? 'CAMP\nNOTES' : 'OFF\nSEASON'} fontSize={width < 380 ? 73 : 84} color={p.heroInk} textShadowColor={p.hero} style={{ marginLeft: 17, marginTop: 7, transform: [{ rotate: '-4deg' }], zIndex: 2 }} />
        <View style={{ position: 'absolute', left: 19, bottom: 22, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: p.paper, borderWidth: 2, borderColor: p.frame, transform: [{ rotate: '-5deg' }] }}>
          <Text style={[styles.body, { color: p.ink, fontSize: 10, fontWeight: '800' }]}>{camp ? 'MAKE YOUR WATCHLIST' : 'YOUR CLUB. ALL YEAR.'}</Text>
        </View>
      </View>
      <View style={{ backgroundColor: p.frame, padding: 19 }}>
        <Text style={{ fontFamily: arenaType.display, color: p.frameInk, fontSize: 30 }}>{camp ? 'A fresh sheet of ice.' : 'The next chapter starts here.'}</Text>
        <Text style={[styles.body, { color: p.frameInk, fontSize: 12, lineHeight: 19, marginTop: 3 }]}>{camp ? 'Watch the players you want to follow. Use last season as a baseline, then check the exhibitions.' : 'Build your watchlist, set your home team and keep the moments from your season.'}</Text>
      </View>
    </View>
    <View style={{ marginTop: 14 }}><ArenaButton label="Open watched players" icon="person-add-outline" onPress={() => router.push('/(tabs)/following')} /></View>
    <View style={{ flexDirection: 'row', gap: 10, marginTop: 11 }}>
      <ArenaButton label="Your teams" icon="flag-outline" secondary style={{ flex: 1 }} onPress={() => router.push('/(tabs)/following')} />
      <ArenaButton label="Season book" icon="albums-outline" secondary style={{ flex: 1 }} onPress={onBook} />
    </View>
  </View>;
}

export function SeasonGuide({ phase, onBook }: { phase: SeasonPhase; onBook: () => void }) {
  const { palette: p } = useArena();
  const [selected, setSelected] = useState(phase);
  const [expanded, setExpanded] = useState(phase === 'offseason' || phase === 'preseason');
  const [reduced, setReduced] = useState(true);
  const position = useRef(new Animated.Value(PHASES.findIndex(item => item.key === phase))).current;
  const [rinkWidth, setRinkWidth] = useState(0);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => listener.remove();
  }, []);
  useEffect(() => { setSelected(phase); setExpanded(phase === 'offseason' || phase === 'preseason'); position.setValue(PHASES.findIndex(item => item.key === phase)); }, [phase, position]);
  const item = PHASES.find(entry => entry.key === selected)!;
  const choose = (key: SeasonPhase, index: number) => {
    setSelected(key);
    Animated.timing(position, { toValue: index, duration: reduced ? 0 : 400, useNativeDriver: true }).start();
  };
  return <View style={{ marginTop: 23, marginBottom: 10 }}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel="Your year on the ice" onPress={() => setExpanded(value => !value)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 48 }}>
      <Text style={{ fontFamily: arenaType.display, color: p.ink, fontSize: 31 }}>YOUR YEAR ON THE ICE</Text><Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={p.link} />
    </Pressable>
    {expanded && <><Text style={[styles.body, { color: p.muted, fontSize: 11, marginTop: 2, marginBottom: 13 }]}>Tap a chapter to see what’s useful.</Text>
    <View style={{ borderWidth: 1.5, borderColor: p.edge, borderRadius: 18, backgroundColor: p.paper, padding: 14 }}>
      <View onLayout={event => setRinkWidth(event.nativeEvent.layout.width)} style={{ height: 78 }} accessible={false}>
        <Svg accessible={false} pointerEvents="none" width="100%" height="78" viewBox="0 0 320 78" preserveAspectRatio="none">
          <Rect x="2" y="2" width="316" height="74" rx="32" fill={p.soft} stroke={p.edge} strokeWidth="2" />
          <Line x1="111" x2="111" y1="3" y2="75" stroke={p.hero} strokeWidth="3" />
          <Line x1="210" x2="210" y1="3" y2="75" stroke={p.hero} strokeWidth="3" />
          <Line x1="160" x2="160" y1="3" y2="75" stroke={p.action} strokeWidth="3" />
          <Circle cx="160" cy="39" r="24" fill="none" stroke={p.action} strokeWidth="2" />
          {[43, 278].map(x => <G key={x}><Circle cx={x} cy="26" r="11" fill="none" stroke={p.edge} /><Circle cx={x} cy="54" r="11" fill="none" stroke={p.edge} /></G>)}
        </Svg>
        <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 23, left: -15, width: 30, height: 28, borderRadius: 16, backgroundColor: p.frame, borderWidth: 3, borderColor: p.action, borderBottomWidth: 7, transform: [{ translateX: position.interpolate({ inputRange: [0, 3], outputRange: [rinkWidth / 8, rinkWidth * 7 / 8] }) }] }} />
      </View>
      <View style={{ flexDirection: 'row', marginTop: 3 }}>
        {PHASES.map((entry, index) => <Pressable key={entry.key} accessibilityRole="tab" accessibilityState={{ selected: selected === entry.key }} accessibilityLabel={`${entry.label}${phase === entry.key ? ', current chapter' : ''}`} onPress={() => choose(entry.key, index)} style={{ flex: 1, minHeight: 49, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={[styles.body, { fontSize: 10, fontWeight: selected === entry.key ? '800' : '500', color: selected === entry.key ? p.link : p.muted }]}>{entry.label}</Text>
          {phase === entry.key && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: p.link, marginTop: 4 }} />}
        </Pressable>)}
      </View>
      <View style={{ borderTopWidth: 1, borderColor: p.edge, paddingTop: 13 }} accessibilityLiveRegion="polite">
        <Text style={[styles.body, { fontWeight: '800', color: p.ink, fontSize: 14 }]}>{item.title}</Text>
        <Text style={[styles.body, { color: p.muted, fontSize: 12, lineHeight: 19, marginTop: 6 }]}>{item.copy}</Text>
        <Pressable accessibilityRole="button" onPress={selected === 'offseason' || selected === 'preseason' ? () => router.push('/(tabs)/following') : onBook} style={{ minHeight: 48, justifyContent: 'center' }}>
          <Text style={[styles.body, { color: p.link, fontWeight: '700', fontSize: 12 }]}>{selected === 'offseason' || selected === 'preseason' ? 'Open watched players' : 'Open season book'}</Text>
        </Pressable>
      </View>
    </View></>}
  </View>;
}

const styles = StyleSheet.create({ body: { fontFamily: arenaType.body } });
