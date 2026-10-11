import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { addDays, shortDate, weekdayAbbrev } from '../../services/nhl/dates';
import { colors } from '../coach/ui';

/** A compact date control retains all fourteen planning dates without a second tab row. */
export function LineupDatePicker({
  today,
  offset,
  onChange,
}: {
  today: string;
  offset: number;
  onChange: (offset: number) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        style={({ pressed }) => [
          styles.trigger,
          pressed && { backgroundColor: colors.raised },
        ]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Choose lineup date, ${shortDate(addDays(today, offset))}`}
        testID="lineup-date-picker"
        hitSlop={2}
      >
        <Text style={styles.label}>
          {offset === 0 ? 'Today' : shortDate(addDays(today, offset))}
        </Text>
        <Ionicons name="chevron-down" size={12} color={colors.sub} />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.panel} accessibilityViewIsModal>
            <View style={styles.heading}>
              <Text style={styles.title}>Choose lineup date</Text>
              <Pressable
                onPress={() => setOpen(false)}
                style={styles.close}
                accessibilityLabel="Close date picker"
              >
                <Ionicons name="close" size={21} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView>
              {Array.from({ length: 14 }, (_, value) => {
                const date = addDays(today, value);
                return (
                  <Pressable
                    key={date}
                    style={styles.date}
                    onPress={() => {
                      onChange(value);
                      setOpen(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: value === offset }}
                    testID={`lineup-date-${value}`}
                  >
                    <Text
                      style={[
                        styles.label,
                        value === offset && styles.selected,
                      ]}
                    >
                      {value === 0 ? 'Today' : weekdayAbbrev(date)} ·{' '}
                      {shortDate(date)}
                    </Text>
                    {value === offset ? (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={colors.accent}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(168,179,190,0.25)',
    borderRadius: 7,
    paddingHorizontal: 9,
    minHeight: 40,
  },
  label: { fontSize: 13, color: colors.text },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 24,
  },
  panel: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '80%',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  date: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  selected: { color: colors.accent, fontWeight: '600' },
});
