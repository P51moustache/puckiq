/**
 * The art in the guided import sheet (concept B, docs/design/import-guide/concept-b.png): two
 * tilted phones on the rink before the trip to the league app, and three screenshot thumbnails when
 * it's time to pick them. Example players only; generic screens, never a host's logo or UI.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ART } from '../../constants/art';
import { colors } from '../coach/ui';
import { RosterShot, type ShotRow } from './RosterShot';

const FIRST_PAGE: readonly ShotRow[] = [
  { position: 'C', name: 'C. McDavid', meta: 'EDM · C' },
  { position: 'D', name: 'C. Makar', meta: 'COL · D' },
  { position: 'W', name: 'B. Tkachuk', meta: 'OTT · LW' },
  { position: 'W', name: 'J. Robertson', meta: 'DAL · LW' },
  { position: 'G', name: 'I. Shesterkin', meta: 'NYR · G' },
];
const SECOND_PAGE: readonly ShotRow[] = [
  { position: 'C', name: 'N. MacKinnon', meta: 'COL · C' },
  { position: 'W', name: 'N. Kucherov', meta: 'TBL · RW' },
  { position: 'D', name: 'Q. Hughes', meta: 'VAN · D' },
  { position: 'G', name: 'J. Oettinger', meta: 'DAL · G' },
];
const THIRD_PAGE: readonly ShotRow[] = [
  { position: 'BN', name: 'T. Stützle', meta: 'OTT · C' },
  { position: 'BN', name: 'K. Kaprizov', meta: 'MIN · LW' },
  { position: 'IR', name: 'A. Barkov', meta: 'FLA · C' },
  { position: 'BN', name: 'J. Hughes', meta: 'NJD · C' },
];
const BEHIND: readonly ShotRow[] = ['W', 'W', 'D', 'D', 'G'].map((position) => ({ position, name: '', meta: '' }));

/** Height of the phones' window; the phones run past it and fade out like the concept. */
const PHONES_HEIGHT = 330;

/** Before the trip: "screenshot a screen like this one". */
export function RosterPhones({ host }: { host: string }) {
  return (
    <View style={styles.phones} accessible accessibilityLabel={`Screenshot your team's roster screen in ${host}, the list with player names`}>
      <Image source={ART.rink} style={styles.rink} contentFit="cover" accessible={false} />
      <RosterShot host={host} rows={BEHIND} blurred style={styles.back} />
      <RosterShot host={host} rows={FIRST_PAGE} style={styles.front} />
      <LinearGradient colors={[colors.bg, 'rgba(5,10,12,0)']} style={styles.fadeTop} pointerEvents="none" />
      <LinearGradient colors={['rgba(5,10,12,0)', colors.bg]} style={styles.fade} pointerEvents="none" />
    </View>
  );
}

/** Back from the league app: "pick screenshots like these". */
export function RosterThumbs({ host }: { host: string }) {
  return (
    <View style={styles.thumbs} accessible accessibilityLabel={`Two or three screenshots of your ${host} roster`}>
      {[FIRST_PAGE.slice(0, 4), SECOND_PAGE, THIRD_PAGE].map((rows, index) => (
        <RosterShot key={index} host={host} rows={rows} compact style={styles.thumb} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  phones: { height: PHONES_HEIGHT, marginHorizontal: -18, overflow: 'hidden' },
  rink: { ...StyleSheet.absoluteFillObject, opacity: 0.2 },
  back: { position: 'absolute', top: 44, right: '9%', width: '42%', height: 420, opacity: 0.7, transform: [{ rotate: '7deg' }] },
  front: { position: 'absolute', top: 22, left: '14%', width: '54%', height: 440, transform: [{ rotate: '-6deg' }] },
  fadeTop: { position: 'absolute', left: 0, right: 0, top: 0, height: 28 },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 72 },
  thumbs: { flexDirection: 'row', gap: 8 },
  thumb: { flex: 1 },
});
