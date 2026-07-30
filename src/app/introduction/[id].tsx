import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import {
  type Href,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useCallback, useMemo, useState } from 'react';

import {
  AppScreen,
  ErrorState,
  LoadingState,
  StackHeader,
} from '@/components/vouch-ui';
import {
  layout,
  palette,
  radius,
  space,
  typography,
} from '@/constants/design';
import { ApiError, apiGet, apiPost } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import type {
  Introduction,
  IntroductionEnvelope,
  IntroductionState,
} from '@/types/introduction';

const labels: Record<IntroductionState, string> = {
  awaiting_your_response: 'Awaiting your response',
  accepted_waiting: 'Waiting for their response',
  mutual_ready: 'Mutual interest',
  conversation_open: 'Conversation open',
  date_proposed: 'Date proposed',
  date_confirmed: 'Date confirmed',
  debrief_pending: 'Debrief pending',
  completed: 'Completed',
  passed: 'Passed',
  timed_out: 'Timed out',
  kind_closed: 'Closed with care',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

function formatDateTime(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export default function IntroductionDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { width } = useWindowDimensions();
  const photoWidth = Math.min(
    Math.max(width - space.xl * 2, 1),
    layout.contentMaxWidth - space.xl * 2,
  );

  const { session, signOut } = useAuth();
  const accessToken = session?.access_token;
  const [item, setItem] = useState<Introduction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pending, setPending] = useState<'accept' | 'pass' | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [photoIndex, setPhotoIndex] = useState(0);

  const deadline = useMemo(
    () => formatDateTime(item?.response_deadline_at ?? null),
    [item?.response_deadline_at],
  );

  const load = useCallback(async () => {
    if (!id || !accessToken) {
      setErrorMessage('This introduction could not be opened.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await apiGet<IntroductionEnvelope>(
        `/introductions/${encodeURIComponent(id)}`,
        accessToken,
      );
      setItem(response.data);
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.status === 401 ||
          error.code === 'authentication_required')
      ) {
        await signOut();
        return;
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load this introduction.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, id, signOut]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function respond(action: 'accept' | 'pass') {
    if (!item || !accessToken || pending) return;

    setPending(action);
    setErrorMessage('');

    try {
      const response = await apiPost<
        IntroductionEnvelope,
        Record<string, never> | undefined
      >(
        `/introductions/${encodeURIComponent(item.id)}/${action}`,
        accessToken,
        action === 'pass' ? {} : undefined,
        Crypto.randomUUID(),
        { 'If-Match': String(item.version) },
      );

      setItem(response.data);

      if (action === 'accept') {
        if (response.data.conversation_id) {
          const conversationId = response.data.conversation_id;

          Alert.alert(
            'It’s mutual',
            'Your private conversation is now open.',
            [
              { text: 'Not now', style: 'cancel' },
              {
                text: 'Open conversation',
                onPress: () =>
                  router.push(
                    {
                      pathname: '/conversation/[id]',
                      params: { id: conversationId },
                    } as Href,
                  ),
              },
            ],
          );
        } else {
          Alert.alert(
            'Introduction accepted',
            'We’ll let you know when they respond.',
          );
        }
      } else {
        Alert.alert(
          'Introduction passed',
          'Your response is private.',
          [{ text: 'Done', onPress: () => router.back() }],
        );
      }
    } catch (error) {
      if (error instanceof ApiError) {
        if (
          error.status === 401 ||
          error.code === 'authentication_required'
        ) {
          await signOut();
          return;
        }

        if (
          error.code === 'version_conflict' ||
          error.code === 'state_conflict' ||
          error.code === 'introduction_resolved' ||
          error.code === 'response_deadline_passed'
        ) {
          await load();
          Alert.alert(
            'Introduction updated',
            'We refreshed the latest status before saving your response.',
          );
          return;
        }

        setErrorMessage(error.message);
      } else {
        setErrorMessage('Unable to save your response.');
      }
    } finally {
      setPending(null);
    }
  }

  function confirmAccept() {
    Alert.alert(
      'Accept this introduction?',
      'Vouch will share your interest. A conversation opens only when the interest is mutual.',
      [
        { text: 'Not yet', style: 'cancel' },
        { text: 'Accept', onPress: () => void respond('accept') },
      ],
    );
  }

  function confirmPass() {
    Alert.alert(
      'Pass on this introduction?',
      'Your decision remains private.',
      [
        { text: 'Keep reviewing', style: 'cancel' },
        {
          text: 'Pass',
          style: 'destructive',
          onPress: () => void respond('pass'),
        },
      ],
    );
  }

  function updatePhotoIndex(
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) {
    setPhotoIndex(
      Math.round(event.nativeEvent.contentOffset.x / photoWidth),
    );
  }

  if (isLoading) {
    return (
      <AppScreen includeBottomInset>
        <Header />
        <LoadingState label="Opening your introduction…" />
      </AppScreen>
    );
  }

  if (!item) {
    return (
      <AppScreen includeBottomInset>
        <Header />
        <ErrorState
          body={errorMessage}
          onRetry={() => void load()}
          title="This introduction could not be opened"
        />
      </AppScreen>
    );
  }

  const profile = item.profile_snapshot;
  const canAccept = item.available_actions.includes('accept');
  const canPass = item.available_actions.includes('pass');
  const conversationId = item.conversation_id;
  const canOpenConversation = Boolean(
    conversationId &&
      item.available_actions.includes('open_conversation'),
  );

  return (
    <AppScreen includeBottomInset>
      <Header />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {profile.photos.length ? (
          <View>
            <ScrollView
              horizontal
              onMomentumScrollEnd={updatePhotoIndex}
              pagingEnabled
              showsHorizontalScrollIndicator={false}
            >
              {profile.photos.map((photo) => (
                <Image
                  key={photo.id}
                  source={{ uri: photo.url }}
                  style={[styles.photo, { width: photoWidth }]}
                />
              ))}
            </ScrollView>

            {profile.photos.length > 1 ? (
              <View style={styles.dots}>
                {profile.photos.map((photo, index) => (
                  <View
                    key={photo.id}
                    style={[
                      styles.dot,
                      index === photoIndex && styles.activeDot,
                    ]}
                  />
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <View
            style={[
              styles.photo,
              styles.photoPlaceholder,
              { width: photoWidth },
            ]}
          >
            <Text style={styles.initial}>
              {profile.first_name.slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}

        <Text style={styles.name}>
          {profile.first_name}, {profile.age_display}
        </Text>
        <Text style={styles.neighborhood}>{profile.neighborhood}</Text>

        <View style={styles.badge}>
          <Text style={styles.badgeText}>{labels[item.member_state]}</Text>
        </View>

        {deadline && canAccept ? (
          <View style={styles.deadlineCard}>
            <Ionicons color={palette.amber} name="time-outline" size={19} />
            <Text style={styles.deadlineText}>
              Please respond by {deadline}
            </Text>
          </View>
        ) : null}

        {item.introduction_note.body ? (
          <View style={styles.noteCard}>
            <Text style={styles.eyebrow}>A NOTE FROM VOUCH</Text>
            <Text style={styles.noteText}>
              “{item.introduction_note.body}”
            </Text>
          </View>
        ) : null}

        <View style={styles.lensCard}>
          <View style={styles.lensHeader}>
            <View style={styles.lensIcon}>
              <Ionicons
                color={palette.brand}
                name="compass-outline"
                size={22}
              />
            </View>
            <View style={styles.lensHeaderCopy}>
              <Text style={styles.lensEyebrow}>VOUCH COMPATIBILITY LENS</Text>
              <Text style={styles.lensTitle}>
                Look for curiosity, not a score
              </Text>
            </View>
          </View>
          <Text style={styles.lensBody}>
            Chemistry cannot be reduced to a percentage. This introduction was
            human-curated from both private dossiers; use these signals to
            decide whether one conversation feels worth exploring.
          </Text>
          <View style={styles.lensSignals}>
            <LensSignal
              icon="heart-outline"
              label="Human-curated"
              value="Selected with both members’ goals and boundaries in mind"
            />
            <LensSignal
              icon="chatbubbles-outline"
              label="Conversation depth"
              value={`${profile.prompts.length} ${
                profile.prompts.length === 1 ? "prompt" : "prompts"
              } to help you get beyond small talk`}
            />
            <LensSignal
              icon="location-outline"
              label="Local context"
              value={`Based around ${profile.neighborhood}`}
            />
          </View>
          {profile.prompts[0]?.answer ? (
            <View style={styles.curiosityPrompt}>
              <Ionicons
                color={palette.sage}
                name="sparkles-outline"
                size={18}
              />
              <Text style={styles.curiosityText}>
                Start with what made you curious about “
                {profile.prompts[0].answer.length > 96
                  ? `${profile.prompts[0].answer.slice(0, 95)}…`
                  : profile.prompts[0].answer}
                ”
              </Text>
            </View>
          ) : null}
        </View>

        {profile.prompts.map((prompt) => (
          <View key={prompt.id} style={styles.promptCard}>
            <Text style={styles.promptQuestion}>{prompt.question}</Text>
            <Text style={styles.promptAnswer}>{prompt.answer}</Text>
          </View>
        ))}

        {errorMessage ? (
          <Text style={styles.inlineError}>{errorMessage}</Text>
        ) : null}

        {canAccept || canPass ? (
          <View style={styles.actions}>
            {canAccept ? (
              <Pressable
                disabled={pending !== null}
                onPress={confirmAccept}
                style={styles.acceptButton}
              >
                {pending === 'accept' ? (
                  <ActivityIndicator color={palette.white} />
                ) : (
                  <Text style={styles.acceptText}>I’m interested</Text>
                )}
              </Pressable>
            ) : null}

            {canPass ? (
              <Pressable
                disabled={pending !== null}
                onPress={confirmPass}
                style={styles.passButton}
              >
                {pending === 'pass' ? (
                  <ActivityIndicator color={palette.ink} />
                ) : (
                  <Text style={styles.passText}>Kindly pass</Text>
                )}
              </Pressable>
            ) : null}
          </View>
        ) : canOpenConversation && conversationId ? (
          <View style={styles.matchCard}>
            <View style={styles.matchIcon}>
              <Ionicons color={palette.sage} name="heart" size={22} />
            </View>
            <Text style={styles.matchTitle}>
              The interest is mutual.
            </Text>
            <Text style={styles.matchBody}>
              Your private conversation with {profile.first_name} is open.
            </Text>
            <Pressable
              onPress={() =>
                router.push(
                  {
                    pathname: '/conversation/[id]',
                    params: { id: conversationId },
                  } as Href,
                )
              }
              style={styles.openConversationButton}
            >
              <Text style={styles.openConversationText}>
                Open conversation
              </Text>
              <Ionicons
                color={palette.white}
                name="arrow-forward"
                size={18}
              />
            </Pressable>
          </View>
        ) : (
          <View style={styles.resolvedCard}>
            <Text style={styles.resolvedTitle}>
              Your response is recorded.
            </Text>
            <Text style={styles.resolvedBody}>
              Vouch will guide you when the next step becomes available.
            </Text>
          </View>
        )}
      </ScrollView>
    </AppScreen>
  );
}

function LensSignal({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.lensSignal}>
      <View style={styles.lensSignalIcon}>
        <Ionicons color={palette.brand} name={icon} size={18} />
      </View>
      <View style={styles.lensSignalCopy}>
        <Text style={styles.lensSignalLabel}>{label}</Text>
        <Text style={styles.lensSignalValue}>{value}</Text>
      </View>
    </View>
  );
}

function Header() {
  return <StackHeader />;
}

const styles = StyleSheet.create({
  content: {
    alignSelf: 'center',
    maxWidth: layout.contentMaxWidth,
    paddingBottom: space.xxxl,
    paddingHorizontal: space.xl,
    width: '100%',
  },
  photo: {
    aspectRatio: 0.82,
    backgroundColor: palette.canvasStrong,
    borderRadius: radius.lg,
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { color: palette.brand, fontSize: 64, fontWeight: '600' },
  dots: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: 12,
  },
  dot: {
    backgroundColor: palette.borderStrong,
    borderRadius: 4,
    height: 6,
    width: 6,
  },
  activeDot: { backgroundColor: palette.brand, width: 18 },
  name: {
    color: palette.ink,
    marginTop: space.xl,
    ...typography.title,
  },
  neighborhood: { color: palette.muted, fontSize: 16, marginTop: 6 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: palette.sageSoft,
    borderRadius: radius.pill,
    marginTop: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  badgeText: {
    color: palette.sage,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  deadlineCard: {
    alignItems: 'center',
    backgroundColor: palette.amberSoft,
    borderRadius: radius.sm,
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
    padding: 14,
  },
  deadlineText: {
    color: palette.amber,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  noteCard: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: 20,
    padding: 20,
  },
  eyebrow: {
    color: palette.brand,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  noteText: {
    color: palette.inkSoft,
    fontSize: 17,
    fontStyle: 'italic',
    lineHeight: 26,
    marginTop: 12,
  },
  lensCard: {
    backgroundColor: palette.brandSoft,
    borderColor: palette.brandSoftStrong,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: space.lg,
    padding: space.md,
  },
  lensHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space.sm,
  },
  lensIcon: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: radius.sm,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  lensHeaderCopy: {
    flex: 1,
  },
  lensEyebrow: {
    color: palette.brand,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  lensTitle: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
    marginTop: 2,
  },
  lensBody: {
    color: palette.inkSoft,
    marginTop: space.sm,
    ...typography.small,
  },
  lensSignals: {
    gap: space.xs,
    marginTop: space.md,
  },
  lensSignal: {
    alignItems: 'flex-start',
    backgroundColor: palette.surface,
    borderRadius: radius.sm,
    flexDirection: 'row',
    gap: space.sm,
    padding: space.sm,
  },
  lensSignalIcon: {
    alignItems: 'center',
    backgroundColor: palette.canvas,
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  lensSignalCopy: {
    flex: 1,
  },
  lensSignalLabel: {
    color: palette.brand,
    ...typography.caption,
  },
  lensSignalValue: {
    color: palette.inkSoft,
    marginTop: 2,
    ...typography.small,
  },
  curiosityPrompt: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: space.xs,
    marginTop: space.md,
  },
  curiosityText: {
    color: palette.sage,
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  promptCard: {
    borderBottomColor: palette.border,
    borderBottomWidth: 1,
    paddingVertical: 24,
  },
  promptQuestion: {
    color: palette.brand,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  promptAnswer: {
    color: palette.ink,
    fontSize: 20,
    lineHeight: 29,
    marginTop: 10,
  },
  inlineError: {
    backgroundColor: palette.dangerSoft,
    borderRadius: radius.sm,
    color: palette.danger,
    fontSize: 14,
    marginTop: 20,
    padding: 14,
  },
  actions: { gap: 12, marginTop: 28 },
  acceptButton: {
    alignItems: 'center',
    backgroundColor: palette.brand,
    borderRadius: radius.sm,
    height: 58,
    justifyContent: 'center',
  },
  acceptText: { color: palette.white, fontSize: 16, fontWeight: '700' },
  passButton: {
    alignItems: 'center',
    borderColor: palette.borderStrong,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 56,
    justifyContent: 'center',
  },
  passText: { color: palette.ink, fontSize: 16, fontWeight: '700' },
  matchCard: {
    alignItems: 'center',
    backgroundColor: palette.sageSoft,
    borderColor: '#C9DCD2',
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: 28,
    padding: 22,
  },
  matchIcon: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 23,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  matchTitle: {
    color: palette.sage,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 14,
    textAlign: 'center',
  },
  matchBody: {
    color: palette.inkSoft,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 7,
    textAlign: 'center',
  },
  openConversationButton: {
    alignItems: 'center',
    backgroundColor: palette.brand,
    borderRadius: radius.sm,
    flexDirection: 'row',
    gap: 8,
    height: 54,
    justifyContent: 'center',
    marginTop: 18,
    width: '100%',
  },
  openConversationText: {
    color: palette.white,
    fontSize: 15,
    fontWeight: '700',
  },
  resolvedCard: {
    backgroundColor: palette.canvasStrong,
    borderRadius: radius.sm,
    marginTop: 28,
    padding: 18,
  },
  resolvedTitle: { color: palette.ink, fontSize: 16, fontWeight: '700' },
  resolvedBody: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 7,
  },
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 28,
  },
  helper: { color: '#68635D', fontSize: 15, marginTop: 16 },
  errorTitle: {
    color: '#171717',
    fontSize: 28,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  errorBody: {
    color: '#68635D',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
    textAlign: 'center',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#352D28',
    borderRadius: 10,
    height: 52,
    justifyContent: 'center',
    marginTop: 24,
    paddingHorizontal: 28,
  },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
