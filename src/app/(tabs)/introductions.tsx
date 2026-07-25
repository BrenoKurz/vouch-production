import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useCallback, useMemo, useState } from 'react';

import { ApiError, apiGet } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import type {
  Introduction,
  IntroductionState,
  IntroductionsEnvelope,
} from '@/types/introduction';

const stateCopy: Record<
  IntroductionState,
  { label: string; tone: 'attention' | 'active' | 'muted' }
> = {
  awaiting_your_response: {
    label: 'Awaiting your response',
    tone: 'attention',
  },
  accepted_waiting: {
    label: 'Waiting for their response',
    tone: 'active',
  },
  mutual_ready: {
    label: 'Mutual interest',
    tone: 'active',
  },
  conversation_open: {
    label: 'Conversation open',
    tone: 'active',
  },
  date_proposed: {
    label: 'Date proposed',
    tone: 'active',
  },
  date_confirmed: {
    label: 'Date confirmed',
    tone: 'active',
  },
  debrief_pending: {
    label: 'Debrief pending',
    tone: 'attention',
  },
  completed: {
    label: 'Completed',
    tone: 'muted',
  },
  passed: {
    label: 'Passed',
    tone: 'muted',
  },
  timed_out: {
    label: 'Timed out',
    tone: 'muted',
  },
  kind_closed: {
    label: 'Closed with care',
    tone: 'muted',
  },
  expired: {
    label: 'Expired',
    tone: 'muted',
  },
  cancelled: {
    label: 'Cancelled',
    tone: 'muted',
  },
};

function formatDeadline(value: string | null) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function priority(item: Introduction) {
  if (item.member_state === 'awaiting_your_response') return 0;
  if (item.member_state === 'debrief_pending') return 1;
  if (
    item.member_state === 'mutual_ready' ||
    item.member_state === 'conversation_open' ||
    item.member_state === 'date_proposed' ||
    item.member_state === 'date_confirmed'
  ) {
    return 2;
  }
  if (item.member_state === 'accepted_waiting') return 3;
  return 4;
}

export default function IntroductionsScreen() {
  const { session, signOut } = useAuth();
  const [items, setItems] = useState<Introduction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => {
        const priorityDifference = priority(a) - priority(b);
        if (priorityDifference !== 0) return priorityDifference;

        return (
          new Date(b.delivered_at).getTime() -
          new Date(a.delivered_at).getTime()
        );
      }),
    [items],
  );

  const loadIntroductions = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      const accessToken = session?.access_token;

      if (!accessToken) return;

      if (mode === 'initial') setIsLoading(true);
      if (mode === 'refresh') setIsRefreshing(true);
      setErrorMessage('');

      try {
        const response = await apiGet<IntroductionsEnvelope>(
          '/introductions',
          accessToken,
        );
        setItems(response.data);
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
            : 'Unable to load your introductions.',
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [session?.access_token, signOut],
  );

  useFocusEffect(
    useCallback(() => {
      void loadIntroductions('initial');
    }, [loadIntroductions]),
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centered}>
          <ActivityIndicator color="#352D28" size="large" />
          <Text style={styles.loadingText}>
            Gathering your introductions…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (errorMessage && items.length === 0) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centered}>
          <Text style={styles.errorEyebrow}>UNABLE TO LOAD</Text>
          <Text style={styles.errorTitle}>
            Your introductions are still private.
          </Text>
          <Text style={styles.errorBody}>{errorMessage}</Text>
          <Pressable
            onPress={() => void loadIntroductions('initial')}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <FlatList
        contentContainerStyle={[
          styles.listContent,
          sortedItems.length === 0 && styles.emptyListContent,
        ]}
        data={sortedItems}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<EmptyState />}
        ListHeaderComponent={
          sortedItems.length > 0 ? (
            <View style={styles.header}>
              <Text style={styles.eyebrow}>CURATED FOR YOU</Text>
              <Text style={styles.title}>Introductions</Text>
              <Text style={styles.subtitle}>
                Every introduction is selected thoughtfully by Vouch.
              </Text>
              {errorMessage ? (
                <Text style={styles.inlineError}>{errorMessage}</Text>
              ) : null}
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            onRefresh={() => void loadIntroductions('refresh')}
            refreshing={isRefreshing}
            tintColor="#352D28"
          />
        }
        renderItem={({ item }) => <IntroductionCard item={item} />}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

function IntroductionCard({ item }: { item: Introduction }) {
  const status = stateCopy[item.member_state];
  const photo = item.profile_snapshot.photos[0]?.url;
  const deadline = formatDeadline(item.response_deadline_at);
  const prompt = item.profile_snapshot.prompts[0];

  return (
    <View style={styles.card}>
      {photo ? (
        <Image
          accessibilityLabel={`${item.profile_snapshot.first_name}'s profile photo`}
          source={{ uri: photo }}
          style={styles.photo}
        />
      ) : (
        <View style={[styles.photo, styles.photoPlaceholder]}>
          <Text style={styles.photoInitial}>
            {item.profile_snapshot.first_name.slice(0, 1).toUpperCase()}
          </Text>
        </View>
      )}

      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={styles.nameBlock}>
            <Text style={styles.name}>
              {item.profile_snapshot.first_name},{' '}
              {item.profile_snapshot.age_display}
            </Text>
            <Text style={styles.neighborhood}>
              {item.profile_snapshot.neighborhood}
            </Text>
          </View>

          <View
            style={[
              styles.badge,
              status.tone === 'attention' && styles.badgeAttention,
              status.tone === 'active' && styles.badgeActive,
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                status.tone === 'attention' &&
                  styles.badgeTextAttention,
                status.tone === 'active' && styles.badgeTextActive,
              ]}
            >
              {status.label}
            </Text>
          </View>
        </View>

        {item.introduction_note.body ? (
          <Text numberOfLines={3} style={styles.note}>
            {item.introduction_note.body}
          </Text>
        ) : null}

        {prompt ? (
          <View style={styles.promptBlock}>
            <Text style={styles.promptQuestion}>
              {prompt.question}
            </Text>
            <Text numberOfLines={2} style={styles.promptAnswer}>
              {prompt.answer}
            </Text>
          </View>
        ) : null}

        {deadline ? (
          <Text style={styles.deadline}>
            Respond by {deadline}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.eyebrow}>VOUCH</Text>
      <Text style={styles.emptyTitle}>
        Your next introduction will arrive thoughtfully.
      </Text>
      <Text style={styles.emptyBody}>
        There is nothing to review right now. We’ll let you know when
        a curated introduction is ready.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7F4EF',
  },
  listContent: {
    paddingBottom: 36,
    paddingHorizontal: 20,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  header: {
    paddingBottom: 22,
    paddingTop: 22,
  },
  eyebrow: {
    color: '#766E67',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.2,
  },
  title: {
    color: '#171717',
    fontSize: 34,
    fontWeight: '600',
    letterSpacing: -1,
    marginTop: 10,
  },
  subtitle: {
    color: '#68635D',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  inlineError: {
    color: '#A33A32',
    fontSize: 13,
    marginTop: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2DCD5',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  photo: {
    aspectRatio: 1.35,
    backgroundColor: '#EAE4DD',
    width: '100%',
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoInitial: {
    color: '#776E66',
    fontSize: 48,
    fontWeight: '600',
  },
  cardContent: {
    padding: 18,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  nameBlock: {
    flex: 1,
  },
  name: {
    color: '#171717',
    fontSize: 22,
    fontWeight: '700',
  },
  neighborhood: {
    color: '#746D66',
    fontSize: 14,
    marginTop: 4,
  },
  badge: {
    backgroundColor: '#F0ECE7',
    borderRadius: 7,
    maxWidth: 132,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  badgeAttention: {
    backgroundColor: '#F4E4DB',
  },
  badgeActive: {
    backgroundColor: '#E5ECE8',
  },
  badgeText: {
    color: '#6E665F',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  badgeTextAttention: {
    color: '#8B4A32',
  },
  badgeTextActive: {
    color: '#365C4D',
  },
  note: {
    color: '#4E4944',
    fontSize: 15,
    fontStyle: 'italic',
    lineHeight: 22,
    marginTop: 16,
  },
  promptBlock: {
    borderTopColor: '#EEE9E3',
    borderTopWidth: 1,
    marginTop: 16,
    paddingTop: 14,
  },
  promptQuestion: {
    color: '#766E67',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  promptAnswer: {
    color: '#282522',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
  },
  deadline: {
    color: '#8B4A32',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 16,
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 28,
  },
  loadingText: {
    color: '#68635D',
    fontSize: 15,
    marginTop: 18,
  },
  errorEyebrow: {
    color: '#9A4A3E',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  errorTitle: {
    color: '#171717',
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 34,
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
  retryButton: {
    alignItems: 'center',
    backgroundColor: '#352D28',
    borderRadius: 10,
    height: 52,
    justifyContent: 'center',
    marginTop: 26,
    paddingHorizontal: 28,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: '#171717',
    fontSize: 30,
    fontWeight: '600',
    letterSpacing: -0.8,
    lineHeight: 36,
    marginTop: 16,
    textAlign: 'center',
  },
  emptyBody: {
    color: '#68635D',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 14,
    textAlign: 'center',
  },
});
