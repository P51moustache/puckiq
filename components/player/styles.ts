/** Text and row styles the player card's sections share. */

import { StyleSheet } from 'react-native';
import { colors } from '../coach/ui';

export const sectionStyles = StyleSheet.create({
  /** Empty states inside a card. */
  muted: {
    fontSize: 13,
    color: colors.muted,
  },
  /** Small grey note on the right of a SectionLabel. */
  value: {
    fontSize: 12,
    color: colors.sub,
    fontWeight: '700',
  },
  statRow: {
    flexDirection: 'row',
    gap: 6,
  },
  help: {
    fontSize: 12,
    color: colors.sub,
    lineHeight: 17,
  },
  pressed: {
    opacity: 0.7,
  },
});
