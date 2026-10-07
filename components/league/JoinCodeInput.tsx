/**
 * Six code cells, scoreboard style, over one invisible text field. What's typed is normalised as
 * it goes (upper-cased, look-alike characters dropped) and a pasted invite link becomes its code.
 */

import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { ROOM_CODE_LENGTH } from '../../types/league';
import { codeFromLink, normalizeRoomCode } from '../../services/league';
import { colors, display } from '../coach/ui';

export interface CodeInputRead {
  code: string;
  /** Why some of what was typed didn't make it into the code. */
  hint: string | null;
}

/** The field's next value after a keystroke or a paste. */
export function readCodeInput(text: string): CodeInputRead {
  const linked = codeFromLink(text);
  if (linked) return { code: linked, hint: null };
  if (/[:/]/.test(text)) return { code: '', hint: 'That isn’t a PuckIQ invite link.' };
  const typed = text.replace(/[\s-]/g, '');
  const kept = normalizeRoomCode(typed);
  return {
    code: kept.slice(0, ROOM_CODE_LENGTH),
    hint: kept.length < typed.length ? 'Codes never use I, O, 0 or 1. Check the invite.' : null,
  };
}

export function JoinCodeInput({
  value,
  onChange,
  editable = true,
  testID,
}: {
  value: string;
  onChange: (code: string) => void;
  editable?: boolean;
  testID?: string;
}) {
  const [hint, setHint] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const cursor = Math.min(value.length, ROOM_CODE_LENGTH - 1);
  return (
    <View>
      <View style={[styles.cells, !editable && styles.disabled]}>
        {Array.from({ length: ROOM_CODE_LENGTH }, (_, index) => {
          const char = value[index] ?? '';
          return (
            <View key={index} style={[styles.cell, char !== '' && styles.cellFilled, focused && index === cursor && styles.cellCursor]}>
              <Text style={[styles.char, char === '' && styles.charEmpty]}>{char || '·'}</Text>
            </View>
          );
        })}
        <TextInput
          value={value}
          onChangeText={(text) => {
            const next = readCodeInput(text);
            setHint(next.hint);
            onChange(next.code);
          }}
          editable={editable}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          spellCheck={false}
          caretHidden
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={styles.input}
          accessibilityLabel="Room code"
          testID={testID}
        />
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cells: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  disabled: { opacity: 0.35 },
  cell: {
    flex: 1,
    maxWidth: 52,
    height: 62,
    borderRadius: 12,
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  cellFilled: { backgroundColor: colors.ink },
  cellCursor: { borderBottomColor: colors.accent },
  char: { ...display(26), color: colors.onInk },
  charEmpty: { color: colors.muted },
  // Invisible but still tappable, so a tap anywhere on the cells opens the keyboard.
  input: { ...StyleSheet.absoluteFillObject, color: 'transparent', opacity: 0.02 },
  hint: { fontSize: 13, fontWeight: '600', color: colors.warn, textAlign: 'center', marginTop: 8 },
});
