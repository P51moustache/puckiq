import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { barn } from '../constants/barn';

/** Unlit ice. Faceoff, crease, dasher. No line through the names. */
export default function RinkMarkings() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} testID="rink-markings">
      <LinearGradient
        colors={[barn.ground, barn.ice, barn.ground]}
        locations={[0, 0.28, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.lampBloom} />
      <View style={styles.dasher} />
      <View style={styles.faceoffOuter} />
      <View style={styles.faceoffInner} />
      <View style={styles.faceoffDot} />
      <View style={styles.hashTop} />
      <View style={styles.hashBottom} />
      <View style={styles.hashLeft} />
      <View style={styles.hashRight} />
      <View style={styles.crease} />
      <LinearGradient
        colors={['transparent', barn.ground]}
        style={styles.bottomFade}
      />
    </View>
  );
}

const FACEOFF_TOP = -72;
const FACEOFF_LEFT = -110;
const FACEOFF_SIZE = 220;

const styles = StyleSheet.create({
  lampBloom: {
    position: 'absolute',
    top: 118,
    left: 20,
    width: 88,
    height: 10,
    borderRadius: 0,
    backgroundColor: barn.lamp,
  },
  dasher: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 3,
    backgroundColor: `${barn.signal}66`,
  },
  faceoffOuter: {
    position: 'absolute',
    top: FACEOFF_TOP,
    left: FACEOFF_LEFT,
    width: FACEOFF_SIZE,
    height: FACEOFF_SIZE,
    borderRadius: FACEOFF_SIZE / 2,
    borderWidth: 2,
    borderColor: `${barn.ink}18`,
  },
  faceoffInner: {
    position: 'absolute',
    top: FACEOFF_TOP + 66,
    left: FACEOFF_LEFT + 66,
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    borderColor: `${barn.ink}10`,
  },
  faceoffDot: {
    position: 'absolute',
    top: FACEOFF_TOP + 104,
    left: FACEOFF_LEFT + 104,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: `${barn.signal}55`,
  },
  hashTop: {
    position: 'absolute',
    top: FACEOFF_TOP - 14,
    left: FACEOFF_LEFT + 98,
    width: 24,
    height: 14,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: `${barn.ink}16`,
  },
  hashBottom: {
    position: 'absolute',
    top: FACEOFF_TOP + FACEOFF_SIZE,
    left: FACEOFF_LEFT + 98,
    width: 24,
    height: 14,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: `${barn.ink}16`,
  },
  hashLeft: {
    position: 'absolute',
    top: FACEOFF_TOP + 98,
    left: FACEOFF_LEFT - 14,
    width: 14,
    height: 24,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: `${barn.ink}16`,
  },
  hashRight: {
    position: 'absolute',
    top: FACEOFF_TOP + 98,
    left: FACEOFF_LEFT + FACEOFF_SIZE,
    width: 14,
    height: 24,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: `${barn.ink}16`,
  },
  crease: {
    position: 'absolute',
    bottom: 72,
    left: '50%',
    marginLeft: -90,
    width: 180,
    height: 72,
    borderTopLeftRadius: 90,
    borderTopRightRadius: 90,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: `${barn.ink}14`,
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 140,
  },
});
