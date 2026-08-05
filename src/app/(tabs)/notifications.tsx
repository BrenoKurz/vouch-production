import { Ionicons } from "@expo/vector-icons";
import * as Crypto from "expo-crypto";
import type { Href } from "expo-router";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  AppButton,
  AppScreen,
  EmptyState,
  InlineNotice,
  LoadingState,
  PageHeader,
} from "@/components/vouch-ui";
import { layout, palette, radius, space, typography } from "@/constants/design";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { useNotifications } from "@/providers/notification-provider";
import type {
  MarkAllNotificationsReadEnvelope,
  MemberNotification,
  NotificationEnvelope,
  NotificationsEnvelope,
  NotificationType,
} from "@/types/notification";

const icons: Record<
  NotificationType,
  React.ComponentProps<typeof Ionicons>["name"]
> = {
  new_introduction: "sparkles-outline",
  mutual_match: "heart-outline",
  new_message: "chatbubble-outline",
  date_proposed: "calendar-outline",
  date_confirmed: "checkmark-circle-outline",
  date_cancelled: "close-circle-outline",
  date_rescheduled: "calendar-clear-outline",
  debrief_ready: "document-text-outline",
  safety_report_received: "shield-checkmark-outline",
  safety_case_updated: "shield-outline",
  privacy_request_received: "lock-closed-outline",
  privacy_request_updated: "document-lock-outline",
};

const uuidPattern =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

const allowedRoutePatterns = [
  new RegExp(`^/introduction/${uuidPattern}$`),
  new RegExp(`^/conversation/${uuidPattern}$`),
  new RegExp(`^/date/${uuidPattern}$`),
  new RegExp(`^/debrief/${uuidPattern}$`),
  new RegExp(`^/safety-case/${uuidPattern}$`),
  /^\/privacy-requests$/,
];

function safeHref(route: string): Href | null {
  return allowedRoutePatterns.some((pattern) => pattern.test(route))
    ? (route as Href)
    : null;
}

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function isAuthenticationError(error: unknown) {
  return (
    error instanceof ApiError &&
    (error.status === 401 || error.code === "authentication_required")
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
  const [errorMessage, setErrorMessage] = useState("");

  const hasUnread = useMemo(
    () => items.some((item) => item.read_at === null),
    [items],
  );

  const load = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      const accessToken = session?.access_token;
      if (!accessToken) return;

      if (mode === "initial") setIsLoading(true);
      else setIsRefreshing(true);
      setErrorMessage("");

      try {
        const response = await apiGet<NotificationsEnvelope>(
          "/notifications?limit=100&offset=0",
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
            : "Unable to load your notifications.",
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [refreshUnreadCount, session?.access_token, signOut],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
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
            candidate.id === item.id ? response.data : candidate,
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
            : "Unable to mark this notification as read.",
        );
        return false;
      }
    },
    [decrementUnreadCount, session?.access_token, signOut],
  );

  const openNotification = useCallback(
    async (item: MemberNotification) => {
      const href = safeHref(item.route);

      if (!href) {
        setErrorMessage("This notification link is unavailable.");
        return;
      }

      setOpeningId(item.id);
      setErrorMessage("");

      try {
        if (await markRead(item)) router.push(href);
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
    setErrorMessage("");

    try {
      await apiPost<MarkAllNotificationsReadEnvelope>(
        "/notifications/read-all",
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
          : "Unable to mark all notifications as read.",
      );
    } finally {
      setIsMarkingAll(false);
    }
  }, [clearUnreadCount, hasUnread, session?.access_token, signOut]);

  if (isLoading && items.length === 0) {
    return (
      <AppScreen>
        <LoadingState label="Loading your private updates…" />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <FlatList
        contentContainerStyle={[
          styles.list,
          items.length === 0 && styles.emptyList,
        ]}
        data={items}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <PageHeader
              action={
                hasUnread ? (
                  <AppButton
                    compact
                    label="Mark all read"
                    loading={isMarkingAll}
                    onPress={() => void markAllRead()}
                    variant="secondary"
                  />
                ) : undefined
              }
              eyebrow="YOUR UPDATES"
              subtitle={
                unreadCount > 0
                  ? `${unreadCount} unread ${
                      unreadCount === 1 ? "update" : "updates"
                    }`
                  : "You’re all caught up."
              }
              title="Notifications"
            />

            {errorMessage ? (
              <InlineNotice
                actionLabel="Try again"
                message={errorMessage}
                onAction={() => void load()}
                tone="danger"
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            body="Introductions, messages, date changes, and private safety updates will appear here."
            icon="notifications-outline"
            title="You’re all caught up"
          />
        }
        refreshControl={
          <RefreshControl
            onRefresh={() => void load("refresh")}
            refreshing={isRefreshing}
            tintColor={palette.brand}
          />
        }
        renderItem={({ item }) => (
          <NotificationCard
            isOpening={openingId === item.id}
            item={item}
            onPress={() => void openNotification(item)}
          />
        )}
        showsVerticalScrollIndicator={false}
      />
    </AppScreen>
  );
}

function NotificationCard({
  item,
  isOpening,
  onPress,
}: {
  item: MemberNotification;
  isOpening: boolean;
  onPress: () => void;
}) {
  const isUnread = item.read_at === null;

  return (
    <Pressable
      accessibilityHint="Opens this update"
      accessibilityLabel={`${isUnread ? "Unread. " : ""}${item.title}. ${
        item.body
      }`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        isUnread && styles.unreadCard,
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[styles.iconContainer, isUnread && styles.unreadIconContainer]}
      >
        <Ionicons
          color={isUnread ? palette.brand : palette.muted}
          name={icons[item.notification_type]}
          size={22}
        />
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text
            numberOfLines={2}
            style={[styles.cardTitle, isUnread && styles.unreadTitle]}
          >
            {item.title}
          </Text>
          {isUnread ? (
            <View accessibilityLabel="Unread" style={styles.unreadDot} />
          ) : null}
        </View>
        <Text numberOfLines={3} style={styles.cardText}>
          {item.body}
        </Text>
        <Text style={styles.timestamp}>{formatCreatedAt(item.created_at)}</Text>
      </View>

      {isOpening ? (
        <ActivityIndicator color={palette.brand} size="small" />
      ) : (
        <Ionicons color={palette.subtle} name="chevron-forward" size={18} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    alignSelf: "center",
    maxWidth: layout.contentMaxWidth,
    paddingBottom: space.xxxl,
    paddingHorizontal: space.lg,
    width: "100%",
  },
  emptyList: {
    flexGrow: 1,
  },
  card: {
    alignItems: "center",
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: space.sm,
    marginBottom: space.sm,
    minHeight: 106,
    padding: space.md,
  },
  unreadCard: {
    backgroundColor: "#FFFAF6",
    borderColor: palette.brandSoftStrong,
  },
  pressed: {
    opacity: 0.76,
  },
  iconContainer: {
    alignItems: "center",
    backgroundColor: palette.canvasStrong,
    borderRadius: radius.sm,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  unreadIconContainer: {
    backgroundColor: palette.brandSoft,
  },
  cardBody: {
    flex: 1,
  },
  cardTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.xs,
  },
  cardTitle: {
    color: palette.inkSoft,
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
  },
  unreadTitle: {
    color: palette.ink,
    fontWeight: "800",
  },
  unreadDot: {
    backgroundColor: palette.brand,
    borderRadius: radius.pill,
    height: 8,
    width: 8,
  },
  cardText: {
    color: palette.muted,
    marginTop: 5,
    ...typography.small,
  },
  timestamp: {
    color: palette.subtle,
    fontSize: 11,
    marginTop: space.xs,
  },
});
