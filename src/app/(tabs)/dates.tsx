import { Ionicons } from '@expo/vector-icons';
import {
  type Href,
  router,
  useFocusEffect,
} from 'expo-router';
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
import { useCallback, useState } from 'react';

import { ApiError, apiGet } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import type {
  DateState,
  DatesEnvelope,
  VouchDate,
} from '@/types/date';

const labels: Record<DateState, string> = {
  proposed: 'Awaiting confirmation',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  scheduled_time_passed: 'Date completed',
  debrief_pending: 'Debrief pending',
  completed: 'Completed',
  disputed: 'Under review',
};

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export default function DatesScreen() {
  const { session, signOut } = useAuth();
  const [items, setItems] = useState<VouchDate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!session?.access_token) return;

      if (mode === 'initial') setIsLoading(true);
      if (mode === 'refresh') setIsRefreshing(true);
      setErrorMessage('');

      try {
        const response = await apiGet<DatesEnvelope>(
          '/dates',
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
            : 'Unable to load your dates.',
        );
      } finally {
        if (mode === 'initial') setIsLoading(false);
        if (mode === 'refresh') setIsRefreshing(false);
      }
    },
    [session?.access_token, signOut],
  );

  useFocusEffect(
    useCallback(() => {
      void load('initial');
    }, [load]),
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator color="#352D28" size="large" />
          <Text style={styles.helper}>Loading your dates…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <FlatList
        contentContainerStyle={[
          styles.list,
          items.length === 0 && styles.emptyList,
        ]}
        data={items}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>YOUR CONNECTIONS</Text>
            <Text style={styles.title}>Dates</Text>
            <Text style={styles.helper}>
              Proposals, confirmations, and upcoming plans appear here.
            </Text>

            {errorMessage ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{errorMessage}</Text>
                <Pressable onPress={() => void load('initial')}>
                  <Text style={styles.retryText}>Try again</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons
                color="#766E67"
                name="calendar-outline"
                size={28}
              />
            </View>
            <Text style={styles.emptyTitle}>No dates yet</Text>
            <Text style={styles.emptyBody}>
              When a date is proposed from a conversation, it will appear
              here.
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            onRefresh={() => void load('refresh')}
            refreshing={isRefreshing}
            tintColor="#352D28"
          />
        }
        renderItem={({ item }) => <DateCard item={item} />}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

function DateCard({ item }: { item: VouchDate }) {
  const photo = item.counterpart_profile.photos[0]?.url;

  function open() {
    router.push(
      {
        pathname: '/date/[id]',
        params: { id: item.id },
      } as Href,
    );
  }

  return (
    <Pressable
      onPress={open}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.pressed,
      ]}
    >
      {photo ? (
        <Image source={{ uri: photo }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Text style={styles.initial}>
            {item.counterpart_profile.first_name
              .slice(0, 1)
              .toUpperCase()}
          </Text>
        </View>
      )}

      <View style={styles.cardBody}>
        <Text style={styles.name}>
          {item.counterpart_profile.first_name}
        </Text>
        <Text style={styles.dateTime}>
          {formatDateTime(item.starts_at)}
        </Text>
        <Text style={styles.venue}>
          {item.venue?.name ?? 'Location to be decided together'}
        </Text>

        <View style={styles.cardFooter}>
          <View
            style={[
              styles.badge,
              item.state === 'confirmed' && styles.confirmedBadge,
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                item.state === 'confirmed' &&
                  styles.confirmedBadgeText,
              ]}
            >
              {labels[item.state]}
            </Text>
          </View>

          {item.can_complete_debrief ? (
            <Text style={styles.actionText}>Debrief →</Text>
          ) : item.can_confirm ? (
            <Text style={styles.actionText}>Review →</Text>
          ) : (
            <Text style={styles.actionText}>View →</Text>
          )}
        </View>
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
  errorBanner: {
    backgroundColor: '#F6E9E6',
    borderRadius: 10,
    marginTop: 18,
    padding: 14,
  },
  errorText: {
    color: '#8D3933',
    fontSize: 14,
    lineHeight: 20,
  },
  retryText: {
    color: '#352D28',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 8,
  },
  card: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2DCD5',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    marginBottom: 14,
    padding: 15,
  },
  pressed: { opacity: 0.86 },
  avatar: {
    backgroundColor: '#EAE4DD',
    borderRadius: 10,
    height: 86,
    width: 72,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: '#776E66',
    fontSize: 30,
    fontWeight: '600',
  },
  cardBody: { flex: 1 },
  name: {
    color: '#171717',
    fontSize: 20,
    fontWeight: '700',
  },
  dateTime: {
    color: '#352D28',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 5,
  },
  venue: {
    color: '#746D66',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  cardFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  badge: {
    backgroundColor: '#F4E4DB',
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  confirmedBadge: { backgroundColor: '#E5ECE8' },
  badgeText: {
    color: '#7A4432',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  confirmedBadgeText: { color: '#365C4D' },
  actionText: {
    color: '#352D28',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 80,
    paddingHorizontal: 34,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: '#EEEAE5',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  emptyTitle: {
    color: '#1F1D1B',
    fontSize: 23,
    fontWeight: '700',
    marginTop: 18,
  },
  emptyBody: {
    color: '#6F6861',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 9,
    textAlign: 'center',
  },
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 28,
  },
});
