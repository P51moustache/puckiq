import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { arenaType } from '../constants/arenaTypography';
import { useArena } from './arena/ArenaProvider';
import { clearRoster, saveRoster, updateRoster } from '../services/fantasyRoster';
import { searchRosterPlayers, type RosterPlayerSearchResult } from '../services/rosterPlayerSearch';
import type { FantasyPlayer, FantasyRoster, ScoringFormat } from '../types/fantasy';

interface Props { visible: boolean; onDismiss: () => void; onSaved: () => void; existingRoster?: FantasyRoster | null }
const MAX_PLAYERS = 20;

export default function RosterBuilder({ visible, onDismiss, onSaved, existingRoster }: Props) {
  const { palette: p } = useArena();
  const [format, setFormat] = useState<ScoringFormat>('yahoo');
  const [players, setPlayers] = useState<FantasyPlayer[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RosterPlayerSearchResult[]>([]);
  const [searchState, setSearchState] = useState<'idle'|'loading'|'empty'|'error'|'results'>('idle');
  const [saving, setSaving] = useState(false);
  const [failedOperation, setFailedOperation] = useState<'save'|'delete'|null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const openSnapshot = useRef('');
  const requestId = useRef(0);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => listener.remove();
  }, []);
  useEffect(() => {
    if (!visible) return;
    const nextFormat = existingRoster?.scoringFormat ?? 'yahoo';
    const nextPlayers = existingRoster?.players ?? [];
    setFormat(nextFormat); setPlayers(nextPlayers); setQuery(''); setResults([]);
    setSearchState('idle'); setFailedOperation(null); setSaving(false);
    openSnapshot.current = JSON.stringify({ format: nextFormat, ids: nextPlayers.map(x => x.playerId) });
    requestId.current += 1;
  }, [visible, existingRoster]);

  const dirty = JSON.stringify({ format, ids: players.map(x => x.playerId) }) !== openSnapshot.current;
  const close = useCallback(() => {
    if (!dirty) return onDismiss();
    Alert.alert('Discard roster changes?', 'Your unsaved roster changes will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard changes', style: 'destructive', onPress: onDismiss },
    ]);
  }, [dirty, onDismiss]);

  const search = useCallback(async (raw: string) => {
    setQuery(raw); setFailedOperation(null);
    const id = ++requestId.current;
    if (raw.trim().length < 2) { setResults([]); setSearchState('idle'); return; }
    setSearchState('loading');
    try {
      const found = await searchRosterPlayers(raw);
      if (id !== requestId.current) return;
      setResults(found); setSearchState(found.length ? 'results' : 'empty');
    } catch {
      if (id !== requestId.current) return;
      setResults([]); setSearchState('error');
    }
  }, []);

  const add = (item: RosterPlayerSearchResult) => {
    if (players.length >= MAX_PLAYERS || players.some(x => x.playerId === item.id)) return;
    setPlayers(prev => [...prev, { playerId: item.id, playerName: item.fullName, teamAbbrev: item.teamAbbrev, position: item.position, rosterPosition: 'BN' }]);
    setQuery(''); setResults([]); setSearchState('idle'); setFailedOperation(null);
  };
  const save = async () => {
    if (!players.length || saving) return;
    setSaving(true); setFailedOperation(null);
    try {
      if (existingRoster) await updateRoster({ ...existingRoster, scoringFormat: format, players });
      else await saveRoster({ name: 'My Team', scoringFormat: format, players });
      onSaved();
    } catch { setFailedOperation('save'); } finally { setSaving(false); }
  };
  const deleteRoster = async () => {
    if (saving) return;
    setSaving(true); setFailedOperation(null);
    try { await clearRoster(); onSaved(); }
    catch { setFailedOperation('delete'); }
    finally { setSaving(false); }
  };
  const removeRoster = () => Alert.alert('Delete roster?', 'This removes your saved roster from this device.', [
    { text: 'Keep roster', style: 'cancel' },
    { text: 'Delete roster', style: 'destructive', onPress: deleteRoster },
  ]);

  return <Modal visible={visible} animationType={reducedMotion ? 'none' : 'slide'} presentationStyle="pageSheet" onRequestClose={close} testID="roster-builder-modal">
    <SafeAreaView style={[styles.container, { backgroundColor: p.page }]}>
      <View style={[styles.header, { borderBottomColor: p.edge }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel roster editing" hitSlop={6} onPress={close} style={styles.headerAction} testID="roster-builder-cancel"><Text style={[styles.link, { color: p.link }]}>Cancel</Text></Pressable>
        <Text accessibilityRole="header" style={[styles.title, { color: p.ink }]}>{existingRoster ? 'EDIT ROSTER' : 'BUILD ROSTER'}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={failedOperation === 'save' ? 'Retry saving roster' : 'Save roster'} accessibilityState={{ disabled: !players.length || saving, busy: saving }} onPress={save} disabled={!players.length || saving} style={styles.headerAction} testID="roster-builder-save"><Text style={[styles.link, { color: p.link, opacity: !players.length || saving ? .45 : 1 }]}>{saving ? 'Working…' : failedOperation === 'save' ? 'Retry' : 'Save'}</Text></Pressable>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardArea} keyboardVerticalOffset={0}>
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" testID="roster-builder-scroll">
        <Text style={[styles.label, { color: p.muted }]}>SCORING FORMAT</Text>
        <View style={styles.row}>{(['yahoo','espn'] as ScoringFormat[]).map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: format === value }} onPress={() => { setFormat(value); setFailedOperation(null); }} style={[styles.choice, { backgroundColor: format === value ? p.action : p.paper, borderColor: format === value ? p.frame : p.edge }]} testID={`format-${value}`}><Text style={[styles.choiceText, { color: format === value ? p.actionInk : p.ink }]}>{value === 'yahoo' ? 'Yahoo' : 'ESPN'}</Text></Pressable>)}</View>
        <View style={[styles.search, { backgroundColor: p.paper, borderColor: p.edge }]}><Ionicons name="search" size={20} color={p.muted}/><TextInput accessibilityLabel="Search players by first, last, or full name" style={[styles.input, { color: p.ink }]} placeholder="First, last, or full name" placeholderTextColor={p.muted} value={query} onChangeText={search} autoCorrect={false} testID="roster-search-input"/></View>
        <Text style={[styles.count, { color: p.muted }]}>{players.length} of {MAX_PLAYERS} players</Text>
        <View style={styles.chips}>{players.map(player => <Pressable key={player.playerId} accessibilityRole="button" accessibilityLabel={`Remove ${player.playerName}`} onPress={() => { setPlayers(prev => prev.filter(x => x.playerId !== player.playerId)); setFailedOperation(null); }} style={[styles.chip, { backgroundColor: p.soft, borderColor: p.edge }]} testID={`chip-${player.playerId}`}><Text style={[styles.chipText, { color: p.ink }]} numberOfLines={2}>{player.playerName}</Text><Ionicons name="close" size={18} color={p.ink}/></Pressable>)}</View>
        {failedOperation === 'save' && <View accessibilityRole="alert" style={[styles.feedback, { backgroundColor: p.soft, borderColor: p.edge }]}><Text style={[styles.feedbackText, { color: p.ink }]}>Roster could not be saved. Your changes are still here.</Text></View>}
        {failedOperation === 'delete' && <View accessibilityRole="alert" style={[styles.feedback, { backgroundColor: p.soft, borderColor: p.edge }]}><Text style={[styles.feedbackText, { color: p.ink }]}>Roster could not be deleted. Your roster is unchanged.</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry deleting roster" onPress={deleteRoster} style={styles.retry} testID="roster-builder-retry-delete"><Text style={{ color: p.link, fontWeight: '800' }}>Retry delete</Text></Pressable></View>}
        {searchState === 'loading' && <ActivityIndicator color={p.action} style={styles.status}/>}
        {searchState === 'error' && <View style={styles.status}><Text accessibilityRole="alert" style={{ color: p.ink }}>Player search is unavailable.</Text><Pressable accessibilityRole="button" onPress={() => search(query)} style={styles.retry}><Text style={{ color: p.link, fontWeight: '700' }}>Retry search</Text></Pressable></View>}
        {searchState === 'empty' && <Text style={[styles.status, { color: p.muted }]}>No matching players found.</Text>}
        {results.map(item => { const added = players.some(x => x.playerId === item.id); const full = players.length >= MAX_PLAYERS; return <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={added ? `${item.fullName}, already on roster` : `Add ${item.fullName}`} accessibilityState={{ disabled: added || full }} disabled={added || full} onPress={() => add(item)} style={[styles.result, { borderBottomColor: p.edge, opacity: added || full ? .45 : 1 }]} testID={`search-result-${item.id}`}><View style={{ flex: 1 }}><Text style={[styles.resultName, { color: p.ink }]}>{item.fullName}</Text><Text style={{ color: p.muted }}>{item.teamAbbrev} · {item.position}</Text></View>{added && <Ionicons name="checkmark-circle" size={20} color={p.link}/>}</Pressable>; })}
        {existingRoster && <Pressable accessibilityRole="button" accessibilityLabel="Delete roster" disabled={saving} onPress={removeRoster} style={[styles.delete, { borderColor: '#B42318' }]} testID="delete-roster"><Text style={{ color: '#B42318', fontWeight: '800' }}>Delete roster</Text></Pressable>}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  container:{flex:1}, keyboardArea:{flex:1}, header:{minHeight:64,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:12,borderBottomWidth:1}, headerAction:{minWidth:64,minHeight:48,justifyContent:'center'}, link:{fontFamily:arenaType.body,fontWeight:'800',fontSize:16}, title:{fontFamily:arenaType.display,fontSize:22,flexShrink:1,textAlign:'center'}, content:{flex:1}, contentContainer:{padding:16,paddingBottom:32}, label:{fontFamily:arenaType.body,fontWeight:'800',fontSize:12,letterSpacing:1,marginBottom:8}, row:{flexDirection:'row',gap:8,marginBottom:16}, choice:{flex:1,minHeight:48,borderWidth:1,borderRadius:10,alignItems:'center',justifyContent:'center'}, choiceText:{fontFamily:arenaType.body,fontWeight:'800'}, search:{minHeight:50,borderWidth:1,borderRadius:12,flexDirection:'row',alignItems:'center',paddingHorizontal:12,gap:8}, input:{flex:1,minHeight:48,fontFamily:arenaType.body,fontSize:16}, count:{fontFamily:arenaType.body,fontSize:13,marginVertical:10}, chips:{flexDirection:'row',flexWrap:'wrap',gap:7}, chip:{minHeight:48,maxWidth:'100%',flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:10,borderWidth:1,borderRadius:12}, chipText:{fontFamily:arenaType.body,fontWeight:'700',maxWidth:250,flexShrink:1}, feedback:{borderWidth:1,borderRadius:10,padding:12,marginTop:12}, feedbackText:{fontFamily:arenaType.body}, status:{marginTop:22,alignSelf:'center',textAlign:'center'}, retry:{minHeight:48,justifyContent:'center',alignItems:'center'}, result:{minHeight:58,flexDirection:'row',alignItems:'center',borderBottomWidth:1}, resultName:{fontFamily:arenaType.body,fontSize:16,fontWeight:'800'}, delete:{minHeight:48,marginTop:24,borderWidth:1,borderRadius:10,alignItems:'center',justifyContent:'center'}
});
