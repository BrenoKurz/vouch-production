import type { Href } from 'expo-router';
import { router, useFocusEffect } from 'expo-router';
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

const states: Record<IntroductionState, string> = {
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

function priority(item: Introduction) {
  if (item.member_state === 'awaiting_your_response') return 0;
  if (item.member_state === 'debrief_pending') return 1;
  if (item.member_state === 'accepted_waiting') return 2;
  return 3;
}

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

export default function IntroductionsScreen() {
  const { session, signOut } = useAuth();
  const [items, setItems] = useState<Introduction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => {
        const byPriority = priority(a) - priority(b);
        if (byPriority !== 0) return byPriority;
        return (
          new Date(b.delivered_at).getTime() -
          new Date(a.delivered_at).getTime()
        );
      }),
    [items],
  );

  const load = useCallback(
    async (refreshing = false) => {
      if (!session?.access_token) return;

      refreshing ? setIsRefreshing(true) : setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await apiGet<IntroductionsEnvelope>(
          '/introductions',
          session.access_token,
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
      void load();
    }, [load]),
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator color="#352D28" size="large" />
          <Text style={styles.helper}>Gathering your introductions…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (errorMessage && items.length === 0) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <Text style={styles.eyebrow}>UNABLE TO LOAD</Text>
          <Text style={styles.emptyTitle}>Your introductions are still private.</Text>
          <Text style={styles.emptyBody}>{errorMessage}</Text>
          <Pressable onPress={() => void load()} style={styles.primaryButton}>
            <Text style={styles.primaryText}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <FlatList
        contentContainerStyle={[
          styles.list,
          sortedItems.length === 0 && styles.emptyList,
        ]}
        data={sortedItems}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          sortedItems.length ? (
            <View style={styles.header}>
              <Text style={styles.eyebrow}>CURATED FOR YOU</Text>
              <Text style={styles.title}>Introductions</Text>
              <Text style={styles.helper}>
                Every introduction is selected thoughtfully by Vouch.
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.eyebrow}>VOUCH</Text>
            <Text style={styles.emptyTitle}>
              Your next introduction will arrive thoughtfully.
            </Text>
            <Text style={styles.emptyBody}>
              There is nothing to review right now.
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            onRefresh={() => void load(true)}
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
  const photo = item.profile_snapshot.photos[0]?.url;
  const prompt = item.profile_snapshot.prompts[0];
  const deadline = formatDeadline(item.response_deadline_at);
  const hasConversation = Boolean(
    item.conversation_id &&
      item.available_actions.includes('open_conversation'),
  );

  function open() {
    router.push(
      {
        pathname: '/introduction/[id]',
        params: { id: item.id },
      } as Href,
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={open}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.pressed,
      ]}
    >
      {photo ? (
        <Image source={{ uri: photo }} style={styles.photo} />
      ) : (
        <View style={[styles.photo, styles.photoPlaceholder]}>
          <Text style={styles.initial}>
            {item.profile_snapshot.first_name.slice(0, 1).toUpperCase()}
          </Text>
        </View>
      )}

      <View style={styles.cardBody}>
        <Text style={styles.name}>
          {item.profile_snapshot.first_name}, {item.profile_snapshot.age_display}
        </Text>
        <Text style={styles.neighborhood}>
          {item.profile_snapshot.neighborhood}
        </Text>

        <View style={styles.badge}>
          <Text style={styles.badgeText}>{states[item.member_state]}</Text>
        </View>

        {item.introduction_note.body ? (
          <Text numberOfLines={3} style={styles.note}>
            {item.introduction_note.body}
          </Text>
        ) : null}

        {prompt ? (
          <View style={styles.prompt}>
            <Text style={styles.promptQuestion}>{prompt.question}</Text>
            <Text numberOfLines={2} style={styles.promptAnswer}>
              {prompt.answer}
            </Text>
          </View>
        ) : null}

        {deadline ? (
          <Text style={styles.deadline}>Respond by {deadline}</Text>
        ) : null}

        <Text style={styles.openLabel}>
          {hasConversation
            ? 'Open conversation →'
            : 'View introduction →'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F4EF' },
  list: { paddingBottom: 36, paddingHorizontal: 20 },
  emptyList: { flexGrow: 1 },
  header: { paddingBottom: 22, paddingTop: 22 },
  eyebrow: {
    color: '#766E67',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  title: {
    color: '#171717',
    fontSize: 34,
    fontWeight: '600',
    letterSpacing: -1,
    marginTop: 10,
  },
  helper: {
    color: '#68635D',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2DCD5',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.86 },
  photo: {
    aspectRatio: 1.35,
    backgroundColor: '#EAE4DD',
    width: '100%',
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { color: '#776E66', fontSize: 48, fontWeight: '600' },
  cardBody: { padding: 18 },
  name: { color: '#171717', fontSize: 23, fontWeight: '700' },
  neighborhood: { color: '#746D66', fontSize: 14, marginTop: 4 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8ECE9',
    borderRadius: 7,
    marginTop: 13,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  badgeText: {
    color: '#365C4D',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  note: {
    color: '#4E4944',
    fontSize: 15,
    fontStyle: 'italic',
    lineHeight: 22,
    marginTop: 16,
  },
  prompt: {
    borderTopColor: '#EEE9E3',
    borderTopWidth: 1,
    marginTop: 16,
    paddingTop: 14,
  },
  promptQuestion: {
    color: '#766E67',
    fontSize: 11,
    fontWeight: '800',
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
  openLabel: {
    color: '#352D28',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 18,
  },
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 28,
  },
  emptyTitle: {
    color: '#171717',
    fontSize: 29,
    fontWeight: '600',
    lineHeight: 35,
    marginTop: 14,
    textAlign: 'center',
  },
  emptyBody: {
    color: '#68635D',
    fontSize: 16,
    lineHeight: 24,
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
