/**
 * Send feedback: pick a kind, write a note, optionally leave an email. Goes straight to
 * Supabase `app_feedback`; if that fails, offers a prefilled email instead.
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Image } from 'expo-image';
import { ART, ART_ASPECT } from '../../constants/art';
import {
  buildFeedbackRow,
  FEEDBACK_CATEGORIES,
  FEEDBACK_MAX,
  feedbackMailto,
  feedbackProblem,
  type FeedbackCategory,
  sendFeedback,
} from '../../services/feedback';
import { track } from '../../services/analytics/track';
import { useAuthContext } from '../auth/AuthProvider';
import { useSubscription } from '../SubscriptionProvider';
import { Card, colors, display, PrimaryButton, SectionLabel } from '../coach/ui';

interface FeedbackSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Where it was opened from, attached to the report. */
  source?: string;
}

export default function FeedbackSheet({ visible, onClose, source = 'settings' }: FeedbackSheetProps) {
  const { user } = useAuthContext();
  const { isPremium } = useSubscription();
  const [category, setCategory] = useState<FeedbackCategory>('bug');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(user?.email ?? '');
  const [problem, setProblem] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (visible) {
      setSent(false);
      setProblem(null);
      if (!email && user?.email) setEmail(user.email);
    }
    // Only re-seed when the sheet opens; a draft survives closing it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const prompt = FEEDBACK_CATEGORIES.find((c) => c.id === category)?.prompt;

  const send = async () => {
    const input = { category, message, email };
    const why = feedbackProblem(input);
    if (why) {
      setProblem(why);
      return;
    }
    const row = buildFeedbackRow(input, {
      appVersion: Constants.expoConfig?.version,
      build: Constants.expoConfig?.ios?.buildNumber,
      platform: Platform.OS,
      osVersion: String(Platform.Version),
      device: Device.modelName ?? undefined,
      isPro: isPremium,
      screen: source,
      userId: user?.id ?? null,
    });
    setSending(true);
    try {
      await sendFeedback(row);
      track('feedback_sent', { category, via: 'app' });
      setMessage('');
      setSent(true);
    } catch {
      Alert.alert('Couldn’t send', 'Check your connection and try again, or send it by email.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Email instead',
          onPress: () => {
            track('feedback_sent', { category, via: 'email' });
            Linking.openURL(feedbackMailto(row)).catch(() => undefined);
          },
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} testID="feedback-sheet">
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          {sent ? (
            <View style={styles.headerSpacer} />
          ) : (
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" testID="feedback-cancel">
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
          )}
          <Text style={styles.title}>Send feedback</Text>
          {sent ? (
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" testID="feedback-done">
              <Text style={styles.send}>Done</Text>
            </Pressable>
          ) : (
            <Pressable onPress={send} disabled={sending} hitSlop={10} accessibilityRole="button" testID="feedback-send">
              {sending ? <ActivityIndicator color={colors.accent} /> : <Text style={styles.send}>Send</Text>}
            </Pressable>
          )}
        </View>

        {sent ? (
          <View style={styles.sent} testID="feedback-sent">
            <Image source={ART.goalLampBadge} style={styles.sentArt} contentFit="contain" accessible={false} />
            <Text style={styles.sentTitle}>Got it.</Text>
            <Text style={styles.sentBody}>
              Thanks for helping make PuckIQ better.{email.trim() ? ' If we have questions, we’ll email you.' : ''}
            </Text>
            <PrimaryButton label="Done" variant="black" onPress={onClose} style={styles.sentButton} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <SectionLabel title="What kind?" style={styles.firstLabel} />
            <View style={styles.kinds}>
              {FEEDBACK_CATEGORIES.map((kind) => {
                const on = kind.id === category;
                return (
                  <Pressable
                    key={kind.id}
                    onPress={() => setCategory(kind.id)}
                    style={[styles.kind, on && styles.kindOn]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    testID={`feedback-kind-${kind.id}`}
                  >
                    <Text style={[styles.kindText, on && styles.kindTextOn]}>{kind.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Card style={styles.messageCard}>
              <TextInput
                value={message}
                onChangeText={(text) => {
                  setMessage(text);
                  if (problem) setProblem(null);
                }}
                placeholder={prompt}
                placeholderTextColor={colors.muted}
                style={styles.message}
                multiline
                maxLength={FEEDBACK_MAX}
                textAlignVertical="top"
                autoFocus
                testID="feedback-message"
              />
              {message.length > FEEDBACK_MAX - 500 ? (
                <Text style={styles.count}>{FEEDBACK_MAX - message.length} left</Text>
              ) : null}
            </Card>

            <SectionLabel title="Email (optional)" />
            <Card>
              <TextInput
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (problem) setProblem(null);
                }}
                placeholder="you@example.com"
                placeholderTextColor={colors.muted}
                style={styles.email}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
                maxLength={254}
                testID="feedback-email"
              />
            </Card>
            <Text style={styles.footnote}>
              Only if you’d like a reply. Your note is sent with the app version, iOS version, device model, and whether you’re on Pro — never your roster.
            </Text>

            {problem ? <Text style={styles.problem} testID="feedback-problem">{problem}</Text> : null}

            <PrimaryButton label="Send feedback" icon="paper-plane" onPress={send} loading={sending} style={styles.sendButton} testID="feedback-submit" />
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  cancel: {
    fontSize: 16,
    color: colors.sub,
    minWidth: 52,
  },
  headerSpacer: {
    minWidth: 52,
  },
  send: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.accent,
    minWidth: 52,
    textAlign: 'right',
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom: 60,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  firstLabel: {
    marginTop: 12,
  },
  kinds: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  kind: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: colors.raised,
    alignItems: 'center',
  },
  kindOn: {
    backgroundColor: colors.ink,
  },
  kindText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.sub,
  },
  kindTextOn: {
    color: colors.onInk,
  },
  messageCard: {
    paddingBottom: 10,
  },
  message: {
    minHeight: 150,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  count: {
    alignSelf: 'flex-end',
    fontSize: 11,
    color: colors.muted,
    fontVariant: ['tabular-nums'],
  },
  email: {
    fontSize: 16,
    color: colors.text,
    paddingVertical: 2,
  },
  footnote: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
    marginTop: 8,
  },
  problem: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.bad,
    marginTop: 12,
  },
  sendButton: {
    marginTop: 18,
  },
  sent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  sentArt: {
    height: 120,
    width: 120 * ART_ASPECT.goalLampBadge,
    marginBottom: 12,
  },
  sentTitle: {
    ...display(40),
    color: colors.text,
  },
  sentBody: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.sub,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 360,
  },
  sentButton: {
    marginTop: 24,
    alignSelf: 'stretch',
    maxWidth: 360,
    width: '100%',
  },
});
