import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import {
  type Href,
  router,
  useFocusEffect,
} from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  useCallback,
  useMemo,
  useState,
} from 'react';

import { ApiError, apiGet, apiPost } from '@/lib/api';
import { useNotifications } from '@/providers/notification-provider';
import { useAuth } from '@/providers/auth-provider';
import type {
  MarkAllNotificationsReadEnvelope,
  MemberNotification,
  NotificationEnvelope,
  NotificationsEnvelope,
  NotificationType,
} from '@/types/notification';

const icons: Record<
  NotificationType,
  React.ComponentProps<typeof Ionicons>['name']
> = {
  new_introduction: 'sparkles-outline',
  mutual_match: 'heart-outline',
  new_message: 'chatbubble-outline',
  date_proposed: 'calendar-outline',
  date_confirmed: 'checkmark-circle-outline',
  date_cancelled: 'close-circle-outline',
  date_rescheduled: 'calendar-clear-outline',
  debrief_ready: 'document-text-outline',
  safety_report_received: 'shield-checkmark-outline',
  safety_case_updated: 'shield-outline',
};

const uuidPattern =
  '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}';

const allowedRoutePatterns = [
  new RegExp(`^/introduction/${uuidPattern}$`),
  new RegExp(`^/conversation/${uuidPattern}$`),
  new RegExp(`^/date/${uuidPattern}$`),
  new RegExp(`^/debrief/${uuidPattern}$`),
  new RegExp(`^/safety-case/${uuidPattern}$`),
];

function safeHref(route: string): Href | null {
  return allowedRoutePatterns.some((pattern) =>
    pattern.test(route),
  )
    ? (route as Href)
    : null;
}

function formatCreatedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function isAuthenticationError(error: unknown) {
  return (
    error instanceof ApiError &&
    (error.status === 401 ||
      error.code === 'authentication_required')
  );
}

export default function NotificationsScreen() {
  const { session, signOut } = useAuth();
  const {
    unreadCount,
    refreshUnreadCount,
    decrementUnreadCount,
    clearUnreadCount,
  } = useNotifications();

  const [items, setItems] = useState<MemberNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const hasUnread = useMemo(
    () => items.some((item) => item.read_at === null),
    [items],
  );

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      const accessToken = session?.access_token;
      if (!accessToken) return;

      if (mode === 'initial') setIsLoading(true);
      if (mode === 'refresh') setIsRefreshing(true);
      setErrorMessage('');

      try {
        const response = await apiGet<NotificationsEnvelope>(
          '/notifications?limit=100&offset=0',
          accessToken,
        );

        setItems(response.data);
        await refreshUnreadCount();
      } catch (error) {
        if (isAuthenticationError(error)) {
          await signOut();
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Unable to load your notifications.',
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [
      refreshUnreadCount,
      session?.access_token,
      signOut,
    ],
  );

  useFocusEffect(
    useCallback(() => {
      void load('initial');
    }, [load]),
  );

  const markRead = useCallback(
    async (item: MemberNotification) => {
      if (item.read_at) return true;

      const accessToken = session?.access_token;
      if (!accessToken) return false;

      try {
        const response = await apiPost<NotificationEnvelope>(
          `/notifications/${item.id}/read`,
          accessToken,
          undefined,
          Crypto.randomUUID(),
        );

        setItems((current) =>
          current.map((candidate) =>
            candidate.id === item.id
              ? response.data
              : candidate,
          ),
        );
        decrementUnreadCount();
        return true;
      } catch (error) {
        if (isAuthenticationError(error)) {
          await signOut();
          return false;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Unable to mark this notification as read.',
        );
        return false;
      }
    },
    [
      decrementUnreadCount,
      session?.access_token,
      signOut,
    ],
  );

  const openNotification = useCallback(
    async (item: MemberNotification) => {
      const href = safeHref(item.route);

      if (!href) {
        setErrorMessage(
          'This notification link is unavailable.',
        );
        return;
      }

      setOpeningId(item.id);
      setErrorMessage('');

      try {
        const marked = await markRead(item);
        if (!marked) return;
        router.push(href);
      } finally {
        setOpeningId(null);
      }
    },
    [markRead],
  );

  const markAllRead = useCallback(async () => {
    const accessToken = session?.access_token;
    if (!accessToken || !hasUnread) return;

    setIsMarkingAll(true);
    setErrorMessage('');

    try {
      await apiPost<MarkAllNotificationsReadEnvelope>(
        '/notifications/read-all',
        accessToken,
        undefined,
        Crypto.randomUUID(),
      );

      const readAt = new Date().toISOString();

      setItems((current) =>
        current.map((item) => ({
          ...item,
          read_at: item.read_at ?? readAt,
        })),
      );
      clearUnreadCount();
    } catch (error) {
      if (isAuthenticationError(error)) {
        await signOut();
        return;
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to mark all notifications as read.',
      );
    } finally {
      setIsMarkingAll(false);
    }
  }, [
    clearUnreadCount,
    hasUnread,
    session?.access_token,
    signOut,
  ]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator color="#352D28" size="large" />
          <Text style={styles.helper}>
            Loading your notifications…
          </Text>
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
            <View style={styles.headerRow}>
              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>YOUR UPDATES</Text>
                <Text style={styles.title}>Notifications</Text>
              </View>

              {hasUnread ? (
                <Pressable
                  accessibilityLabel="Mark all notifications as read"
                  disabled={isMarkingAll}
                  onPress={() => void markAllRead()}
                  style={({ pressed }) => [
                    styles.markAllButton,
                    pressed && styles.pressed,
                  ]}
                >
                  {isMarkingAll ? (
                    <ActivityIndicator
                      color="#352D28"
                      size="small"
                    />
                  ) : (
                    <Text style={styles.markAllText}>
                      Mark all read
                    </Text>
                  )}
                </Pressable>
              ) : null}
            </View>

            <Text style={styles.helper}>
              {unreadCount > 0
                ? `${unreadCount} unread ${
                    unreadCount === 1
                      ? 'update'
                      : 'updates'
                  }`
                : 'You are all caught up.'}
            </Text>

            {errorMessage ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>
                  {errorMessage}
                </Text>
                <Pressable
                  onPress={() => void load('initial')}
                >
                  <Text style={styles.retryText}>
                    Try again
                  </Text>
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
                name="notifications-outline"
                size={29}
              />
            </View>
            <Text style={styles.emptyTitle}>
              No notifications yet
            </Text>
            <Text style={styles.emptyBody}>
              Introductions, messages, date updates, and
              private safety-case updates will appear here.
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
        renderItem={({ item }) => {
          const isUnread = item.read_at === null;
          const isOpening = openingId === item.id;

          return (
            <Pressable
              accessibilityLabel={`${item.title}. ${item.body}`}
              accessibilityRole="button"
              onPress={() =>
                void openNotification(item)
              }
              style={({ pressed }) => [
                styles.card,
                isUnread && styles.unreadCard,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.iconContainer,
                  isUnread && styles.unreadIconContainer,
                ]}
              >
                <Ionicons
                  color={isUnread ? '#352D28' : '#766E67'}
                  name={icons[item.notification_type]}
                  size={22}
                />
              </View>

              <View style={styles.cardBody}>
                <View style={styles.cardTitleRow}>
                  <Text
                    numberOfLines={2}
                    style={[
                      styles.cardTitle,
                      isUnread && styles.unreadTitle,
                    ]}
                  >
                    {item.title}
                  </Text>

                  {isUnread ? (
                    <View
                      accessibilityLabel="Unread"
                      style={styles.unreadDot}
                    />
                  ) : null}
                </View>

                <Text style={styles.cardText}>
                  {item.body}
                </Text>
                <Text style={styles.timestamp}>
                  {formatCreatedAt(item.created_at)}
                </Text>
              </View>

              {isOpening ? (
                <ActivityIndicator
                  color="#352D28"
                  size="small"
                />
              ) : (
                <Ionicons
                  color="#9B938B"
                  name="chevron-forward"
                  size={18}
                />
              )}
            </Pressable>
          );
        }}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#F7F4EF',
    flex: 1,
  },
  list: {
    paddingBottom: 36,
    paddingHorizontal: 20,
  },
  emptyList: {
    flexGrow: 1,
  },
  header: {
    paddingBottom: 22,
    paddingTop: 22,
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
  },
  headerCopy: {
    flex: 1,
  },
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
  markAllButton: {
    alignItems: 'center',
    borderColor: '#CFC7BF',
    borderRadius: 9,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 40,
    minWidth: 104,
    paddingHorizontal: 12,
  },
  markAllText: {
    color: '#352D28',
    fontSize: 12,
    fontWeight: '800',
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
    gap: 13,
    marginBottom: 12,
    minHeight: 102,
    padding: 15,
  },
  unreadCard: {
    backgroundColor: '#FCFAF7',
    borderColor: '#BDB2A8',
  },
  pressed: {
    opacity: 0.78,
  },
  iconContainer: {
    alignItems: 'center',
    backgroundColor: '#EEEAE5',
    borderRadius: 10,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  unreadIconContainer: {
    backgroundColor: '#E9E2DB',
  },
  cardBody: {
    flex: 1,
  },
  cardTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  cardTitle: {
    color: '#4C4742',
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  unreadTitle: {
    color: '#171717',
    fontWeight: '800',
  },
  unreadDot: {
    backgroundColor: '#8B4A32',
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  cardText: {
    color: '#68635D',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },
  timestamp: {
    color: '#918981',
    fontSize: 11,
    marginTop: 8,
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
