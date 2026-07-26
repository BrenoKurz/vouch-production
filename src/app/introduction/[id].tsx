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
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useCallback, useMemo, useState } from 'react';

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
  const photoWidth = Math.max(width - 32, 1);

  const { session, signOut } = useAuth();
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
    if (!id || !session?.access_token) {
      setErrorMessage('This introduction could not be opened.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await apiGet<IntroductionEnvelope>(
        `/introductions/${encodeURIComponent(id)}`,
        session.access_token,
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
  }, [id, session?.access_token, signOut]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function respond(action: 'accept' | 'pass') {
    if (!item || !session?.access_token || pending) return;

    setPending(action);
    setErrorMessage('');

    try {
      const response = await apiPost<
        IntroductionEnvelope,
        Record<string, never> | undefined
      >(
        `/introductions/${encodeURIComponent(item.id)}/${action}`,
        session.access_token,
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
      <SafeAreaView style={styles.screen}>
        <Header />
        <View style={styles.center}>
          <ActivityIndicator color="#352D28" size="large" />
          <Text style={styles.helper}>Opening your introduction…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView style={styles.screen}>
        <Header />
        <View style={styles.center}>
          <Text style={styles.eyebrow}>UNAVAILABLE</Text>
          <Text style={styles.errorTitle}>
            This introduction could not be opened.
          </Text>
          <Text style={styles.errorBody}>{errorMessage}</Text>
          <Pressable onPress={() => void load()} style={styles.primaryButton}>
            <Text style={styles.primaryText}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
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
    <SafeAreaView style={styles.screen}>
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
            <Ionicons color="#8B4A32" name="time-outline" size={19} />
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
                  <ActivityIndicator color="#FFFFFF" />
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
                  <ActivityIndicator color="#352D28" />
                ) : (
                  <Text style={styles.passText}>Kindly pass</Text>
                )}
              </Pressable>
            ) : null}
          </View>
        ) : canOpenConversation && conversationId ? (
          <View style={styles.matchCard}>
            <View style={styles.matchIcon}>
              <Ionicons color="#365C4D" name="heart" size={22} />
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
                color="#FFFFFF"
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
    </SafeAreaView>
  );
}

function Header() {
  return (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Ionicons color="#352D28" name="chevron-back" size={25} />
      </Pressable>
      <Text style={styles.wordmark}>VOUCH</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F4EF' },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 54,
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  backButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  wordmark: {
    color: '#352D28',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 3.2,
  },
  headerSpacer: { width: 40 },
  content: { paddingBottom: 42, paddingHorizontal: 16 },
  photo: {
    aspectRatio: 0.82,
    backgroundColor: '#E8E1DA',
    borderRadius: 12,
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { color: '#776E66', fontSize: 64, fontWeight: '600' },
  dots: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: 12,
  },
  dot: {
    backgroundColor: '#C9C2BA',
    borderRadius: 4,
    height: 6,
    width: 6,
  },
  activeDot: { backgroundColor: '#352D28', width: 18 },
  name: {
    color: '#171717',
    fontSize: 34,
    fontWeight: '600',
    letterSpacing: -1,
    marginTop: 24,
  },
  neighborhood: { color: '#68635D', fontSize: 16, marginTop: 6 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8ECE9',
    borderRadius: 7,
    marginTop: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  badgeText: {
    color: '#365C4D',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  deadlineCard: {
    alignItems: 'center',
    backgroundColor: '#F4E4DB',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
    padding: 14,
  },
  deadlineText: {
    color: '#7A4432',
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  noteCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2DCD5',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 20,
    padding: 20,
  },
  eyebrow: {
    color: '#766E67',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  noteText: {
    color: '#302C29',
    fontSize: 17,
    fontStyle: 'italic',
    lineHeight: 26,
    marginTop: 12,
  },
  promptCard: {
    borderBottomColor: '#DDD6CF',
    borderBottomWidth: 1,
    paddingVertical: 24,
  },
  promptQuestion: {
    color: '#716961',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  promptAnswer: {
    color: '#1F1D1B',
    fontSize: 20,
    lineHeight: 29,
    marginTop: 10,
  },
  inlineError: {
    backgroundColor: '#F6E9E6',
    borderRadius: 9,
    color: '#943D35',
    fontSize: 14,
    marginTop: 20,
    padding: 14,
  },
  actions: { gap: 12, marginTop: 28 },
  acceptButton: {
    alignItems: 'center',
    backgroundColor: '#352D28',
    borderRadius: 10,
    height: 58,
    justifyContent: 'center',
  },
  acceptText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  passButton: {
    alignItems: 'center',
    borderColor: '#BEB6AE',
    borderRadius: 10,
    borderWidth: 1,
    height: 56,
    justifyContent: 'center',
  },
  passText: { color: '#352D28', fontSize: 16, fontWeight: '700' },
  matchCard: {
    alignItems: 'center',
    backgroundColor: '#E8ECE9',
    borderColor: '#D4DED8',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 28,
    padding: 22,
  },
  matchIcon: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 23,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  matchTitle: {
    color: '#244437',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 14,
    textAlign: 'center',
  },
  matchBody: {
    color: '#53675F',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 7,
    textAlign: 'center',
  },
  openConversationButton: {
    alignItems: 'center',
    backgroundColor: '#352D28',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 8,
    height: 54,
    justifyContent: 'center',
    marginTop: 18,
    width: '100%',
  },
  openConversationText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  resolvedCard: {
    backgroundColor: '#EEEAE5',
    borderRadius: 10,
    marginTop: 28,
    padding: 18,
  },
  resolvedTitle: { color: '#282522', fontSize: 16, fontWeight: '700' },
  resolvedBody: {
    color: '#68635D',
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
