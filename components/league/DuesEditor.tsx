/**
 * The owner's dues editor: buy-in per team, currency, deadline, payouts by place and where the
 * pot lives. Checked with the services' rules (`validateDues`) before it saves.
 */

import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { RoomCurrency, RoomDues } from '../../types/league';
import { colors, display, GhostButton, IconButton, SegmentedControl } from '../coach/ui';
import { checkDuesForm, duesToForm, parseAmount, type DuesForm } from './duesForm';
import { DUES_DISCLAIMER } from './DuesCard';
import { moneyText, ordinal } from './format';
import type { LeagueResult } from './useRoomActions';

const CURRENCIES: { value: RoomCurrency; label: string }[] = [
  { value: 'USD', label: 'USD' },
  { value: 'CAD', label: 'CAD' },
];

export function DuesEditor({
  visible,
  dues,
  leagueSize,
  onSave,
  onClose,
}: {
  visible: boolean;
  dues: RoomDues;
  leagueSize: number;
  onSave: (dues: RoomDues) => Promise<LeagueResult>;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {/* Mounted per opening, so the form starts from the room's dues each time. */}
      {visible ? <DuesEditorBody dues={dues} leagueSize={leagueSize} onSave={onSave} onClose={onClose} /> : null}
    </Modal>
  );
}

function wholeOrZero(text: string): number {
  const value = parseAmount(text);
  return value !== null && Number.isFinite(value) ? value : 0;
}

function DuesEditorBody({
  dues,
  leagueSize,
  onSave,
  onClose,
}: {
  dues: RoomDues;
  leagueSize: number;
  onSave: (dues: RoomDues) => Promise<LeagueResult>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<DuesForm>(() => duesToForm(dues));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const update = (patch: Partial<DuesForm>) => setForm((current) => ({ ...current, ...patch }));
  const setPayout = (index: number, text: string) =>
    setForm((current) => ({ ...current, payouts: current.payouts.map((value, at) => (at === index ? text : value)) }));

  const save = async () => {
    const checked = checkDuesForm(form, leagueSize);
    if (!checked.ok) {
      setError(checked.message);
      return;
    }
    setSaving(true);
    setError(null);
    const failed = await onSave(checked.dues);
    setSaving(false);
    if (failed) setError(failed.message);
    else onClose();
  };

  const pot = wholeOrZero(form.amount) * leagueSize;
  const payingOut = form.payouts.reduce((total, text) => total + wholeOrZero(text), 0);

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" style={styles.side} testID="dues-cancel">
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>League dues</Text>
        <Pressable onPress={save} disabled={saving} hitSlop={10} accessibilityRole="button" style={[styles.side, styles.sideRight]} testID="dues-save">
          <Text style={styles.save}>{saving ? 'Saving…' : 'Save'}</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>DUES</Text>

        <Field label="Per team" hint="Leave blank for a room without dues.">
          <View style={styles.moneyRow}>
            <Text style={styles.dollar}>$</Text>
            <TextInput
              value={form.amount}
              onChangeText={(amount) => update({ amount })}
              keyboardType="number-pad"
              placeholder="50"
              placeholderTextColor={colors.muted}
              style={[styles.input, styles.flex]}
              testID="dues-amount"
            />
          </View>
        </Field>

        <Field label="Currency">
          <SegmentedControl<RoomCurrency> options={CURRENCIES} value={form.currency} onChange={(currency) => update({ currency })} testID="dues-currency" />
        </Field>

        <Field label="Deadline" hint="YYYY-MM-DD, or leave blank.">
          <TextInput
            value={form.deadline}
            onChangeText={(deadline) => update({ deadline })}
            placeholder="2026-10-31"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="numbers-and-punctuation"
            style={styles.input}
            testID="dues-deadline"
          />
        </Field>

        <Field label="Payouts" hint={`Pot ${moneyText(pot, form.currency)} for ${leagueSize} teams · paying out ${moneyText(payingOut, form.currency)}`}>
          {form.payouts.map((amount, index) => (
            <View key={index} style={styles.payoutRow}>
              <Text style={styles.place}>{ordinal(index + 1).toUpperCase()}</Text>
              <Text style={styles.dollar}>$</Text>
              <TextInput
                value={amount}
                onChangeText={(text) => setPayout(index, text)}
                keyboardType="number-pad"
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.flex]}
                testID={`dues-payout-${index + 1}`}
              />
              <IconButton
                icon="close"
                label={`Remove ${ordinal(index + 1)} place`}
                onPress={() => setForm((current) => ({ ...current, payouts: current.payouts.filter((_, at) => at !== index) }))}
                testID={`dues-payout-remove-${index + 1}`}
              />
            </View>
          ))}
          {form.payouts.length < leagueSize ? (
            <GhostButton
              label="Add a place"
              icon="add"
              tone="neutral"
              onPress={() => update({ payouts: [...form.payouts, ''] })}
              style={styles.addPlace}
              testID="dues-add-payout"
            />
          ) : null}
        </Field>

        <Field label="Where the pot lives" hint="Optional https link, like a LeagueSafe page.">
          <TextInput
            value={form.potLink}
            onChangeText={(potLink) => update({ potLink })}
            placeholder="https://"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={styles.input}
            testID="dues-pot-link"
          />
        </Field>

        {error ? (
          <Text style={styles.error} testID="dues-error">
            {error}
          </Text>
        ) : null}
        <Text style={styles.footnote}>{DUES_DISCLAIMER}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <View style={styles.kickerRow}>
        <View style={styles.kickerDot} />
        <Text style={styles.kicker}>{label.toUpperCase()}</Text>
      </View>
      {children}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12 },
  side: { minWidth: 64 },
  sideRight: { alignItems: 'flex-end' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  cancel: { fontSize: 16, fontWeight: '600', color: colors.sub },
  save: { fontSize: 16, fontWeight: '800', color: colors.accent },
  content: { paddingHorizontal: 20, paddingBottom: 48 },
  title: { ...display(30), marginTop: 4, marginBottom: 12 },
  field: { marginBottom: 20, gap: 8 },
  kickerRow: { flexDirection: 'row', alignItems: 'center' },
  kickerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent, marginRight: 8 },
  kicker: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, color: colors.text },
  hint: { fontSize: 13, color: colors.sub },
  moneyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dollar: { ...display(20), color: colors.sub },
  input: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  flex: { flex: 1 },
  payoutRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  place: { ...display(16), width: 44, color: colors.accent },
  addPlace: { alignSelf: 'flex-start' },
  error: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.bad, marginBottom: 12 },
  footnote: { fontSize: 13, fontWeight: '700', color: colors.sub },
});
