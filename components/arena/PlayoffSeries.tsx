import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { fetchPlayoffSeries } from '../../services/playoffSeries';
import type { ArenaGame } from '../../types/arena';
import { useArena } from './ArenaProvider';
import { arenaType } from './ArenaPrimitives';

export function PlayoffSeries({ game, onOpen }: { game: ArenaGame; onOpen: (game: ArenaGame) => void }) {
  const { palette: p } = useArena();
  const [series, setSeries] = useState<Awaited<ReturnType<typeof fetchPlayoffSeries>>>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true); setFailed(false); setSeries(null);
    fetchPlayoffSeries(game).then(next => { if (active) setSeries(next); })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [game]);
  return <View style={{ marginTop: 17, marginBottom: 7, borderWidth: 1.5, borderColor: p.frame, borderRadius: 16, padding: 17, backgroundColor: p.paper }}>
    <Text accessibilityRole="header" style={{ fontFamily: arenaType.display, color: p.ink, fontSize: 30 }}>THE SERIES SO FAR</Text>
    <Text style={{ fontFamily: arenaType.body, color: p.muted, fontSize: 11, lineHeight: 17 }}>Known results in the feed. Coverage may be incomplete.</Text>
    {loading ? <ActivityIndicator color={p.ink} style={{ marginTop: 15 }} /> : failed || !series ? <Text style={{ fontFamily: arenaType.body, color: p.muted, fontSize: 12, marginTop: 12 }}>Series results could not be verified. The game preview is still available.</Text> : <>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 14 }}>
        {[{ team: game.away_team_abbrev, wins: series.awayWins }, { team: game.home_team_abbrev, wins: series.homeWins }].map(side => <View key={side.team} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}><Text style={{ fontFamily: arenaType.body, color: p.ink, fontWeight: '800', fontSize: 14 }}>{side.team}</Text><Text style={{ fontFamily: arenaType.display, color: p.ink, fontSize: 38 }}>{side.wins}</Text><Text style={{ fontFamily: arenaType.body, color: p.muted, fontSize: 10 }}>wins</Text></View>)}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {series.games.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Open ${item.away_team_abbrev} at ${item.home_team_abbrev} on ${item.game_date}`} onPress={() => onOpen(item)} style={{ minWidth: 110, minHeight: 78, padding: 11, borderWidth: 1, borderColor: p.edge, borderRadius: 10, backgroundColor: p.soft }}>
          <Text style={{ fontFamily: arenaType.body, color: p.muted, fontSize: 10 }}>{item.game_date}</Text>
          <Text style={{ fontFamily: arenaType.body, color: p.ink, fontWeight: '800', fontSize: 12, marginTop: 6 }}>{item.away_team_abbrev} / {item.home_team_abbrev}</Text>
          <Text style={{ fontFamily: arenaType.body, color: p.ink, fontSize: 12, marginTop: 4 }}>{['FINAL','OFF'].includes(item.game_state) && item.away_score !== null && item.home_score !== null ? `${item.away_score}–${item.home_score}` : 'Open matchup'}</Text>
        </Pressable>)}
      </ScrollView>
    </>}
  </View>;
}
