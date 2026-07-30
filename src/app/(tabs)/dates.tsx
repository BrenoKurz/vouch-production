import { Ionicons } from "@expo/vector-icons";
import type { Href } from "expo-router";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  AppScreen,
  Avatar,
  EmptyState,
  InlineNotice,
  LoadingState,
  PageHeader,
  StatusPill,
  type StatusTone,
} from "@/components/vouch-ui";
import {
  layout,
  palette,
  radius,
  shadow,
  space,
  typography,
} from "@/constants/design";
import { ApiError, apiGet } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import type {
  DateState,
  DatesEnvelope,
  VouchDate,
} from "@/types/date";

const labels: Record<
  DateState,
  { label: string; tone: StatusTone }
> = {
  proposed: { label: "Awaiting confirmation", tone: "warning" },
  confirmed: { label: "Confirmed", tone: "positive" },
  cancelled: { label: "Cancelled", tone: "danger" },
  scheduled_time_passed: { label: "Date complete", tone: "neutral" },
  debrief_pending: { label: "Debrief ready", tone: "warning" },
  completed: { label: "Completed", tone: "neutral" },
  disputed: { label: "Under review", tone: "danger" },
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { day: value, time: "" };
  }

  return {
    day: new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(date),
    time: new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(date),
  };
}

function priority(item: VouchDate) {
  if (item.can_complete_debrief) return 0;
  if (item.can_confirm) return 1;
  if (item.state === "confirmed") return 2;
  if (item.state === "proposed") return 3;
  return 4;
}

export default function DatesScreen() {
  const { session, signOut } = useAuth();
  const accessToken = session?.access_token;
  const [items, setItems] = useState<VouchDate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => {
        const byPriority = priority(a) - priority(b);
        if (byPriority !== 0) return byPriority;
        return (
          new Date(a.starts_at).getTime() -
          new Date(b.starts_at).getTime()
        );
      }),
    [items],
  );

  const load = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (!accessToken) return;

      if (mode === "initial") setIsLoading(true);
      else setIsRefreshing(true);
      setErrorMessage("");

      try {
        const response = await apiGet<DatesEnvelope>("/dates", accessToken);
        setItems(response.data);
      } catch (error) {
        if (
          error instanceof ApiError &&
          (error.status === 401 ||
            error.code === "authentication_required")
        ) {
          await signOut();
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load your dates.",
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [accessToken, signOut],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (isLoading && items.length === 0) {
    return (
      <AppScreen>
        <LoadingState label="Loading your date plans…" />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <FlatList
        contentContainerStyle={[
          styles.list,
          sortedItems.length === 0 && styles.emptyList,
        ]}
        data={sortedItems}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <PageHeader
              eyebrow="YOUR PLANS"
              subtitle="Everything you need before, during, and after a Vouch date."
              title="Dates"
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
            body="When you make a plan from a private conversation, it will appear here with everything you need."
            icon="calendar-outline"
            title="No dates planned yet"
          />
        }
        refreshControl={
          <RefreshControl
            onRefresh={() => void load("refresh")}
            refreshing={isRefreshing}
            tintColor={palette.brand}
          />
        }
        renderItem={({ item }) => <DateCard item={item} />}
        showsVerticalScrollIndicator={false}
      />
    </AppScreen>
  );
}

function DateCard({ item }: { item: VouchDate }) {
  const profile = item.counterpart_profile;
  const date = formatDate(item.starts_at);
  const state = labels[item.state];

  const actionLabel = item.can_complete_debrief
    ? "Complete debrief"
    : item.can_confirm
      ? "Review proposal"
      : item.state === "cancelled" && item.can_reschedule
        ? "Propose a new time"
        : "View details";

  function open() {
    router.push(
      {
        pathname: "/date/[id]",
        params: { id: item.id },
      } as Href,
    );
  }

  return (
    <Pressable
      accessibilityHint="Opens date details"
      accessibilityLabel={`${state.label} date with ${profile.first_name}, ${date.day} at ${date.time}`}
      accessibilityRole="button"
      onPress={open}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.cardHeader}>
        <Avatar
          firstName={profile.first_name}
          size={64}
          uri={profile.photos[0]?.url}
        />
        <View style={styles.personCopy}>
          <StatusPill label={state.label} tone={state.tone} />
          <Text style={styles.name}>With {profile.first_name}</Text>
        </View>
        <Ionicons
          color={palette.subtle}
          name="chevron-forward"
          size={20}
        />
      </View>

      <View style={styles.details}>
        <DetailRow
          icon="calendar-outline"
          label="Date"
          value={date.day}
        />
        <View style={styles.detailDivider} />
        <DetailRow icon="time-outline" label="Time" value={date.time} />
        <View style={styles.detailDivider} />
        <DetailRow
          icon="location-outline"
          label="Place"
          value={item.venue?.name ?? "Decide together"}
        />
      </View>

      {item.reschedule_count > 0 ? (
        <Text style={styles.updateText}>
          This plan has been updated {item.reschedule_count}{" "}
          {item.reschedule_count === 1 ? "time" : "times"}.
        </Text>
      ) : null}

      <View style={styles.actionRow}>
        <Text style={styles.actionLabel}>{actionLabel}</Text>
        <Ionicons
          color={palette.brand}
          name="arrow-forward"
          size={18}
        />
      </View>
    </Pressable>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Ionicons color={palette.brand} name={icon} size={18} />
      </View>
      <View style={styles.detailCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
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
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: space.lg,
    overflow: "hidden",
    padding: space.lg,
    ...shadow,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.995 }],
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.sm,
  },
  personCopy: {
    flex: 1,
  },
  name: {
    color: palette.ink,
    marginTop: space.xs,
    ...typography.heading,
  },
  details: {
    backgroundColor: palette.canvas,
    borderRadius: radius.md,
    marginTop: space.lg,
    paddingHorizontal: space.md,
  },
  detailRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.sm,
    minHeight: 68,
    paddingVertical: space.sm,
  },
  detailIcon: {
    alignItems: "center",
    backgroundColor: palette.brandSoft,
    borderRadius: radius.sm,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  detailCopy: {
    flex: 1,
  },
  detailLabel: {
    color: palette.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    lineHeight: 13,
    textTransform: "uppercase",
  },
  detailValue: {
    color: palette.ink,
    marginTop: 2,
    ...typography.bodyStrong,
  },
  detailDivider: {
    backgroundColor: palette.border,
    height: 1,
    marginLeft: 48,
  },
  updateText: {
    color: palette.muted,
    marginTop: space.sm,
    ...typography.caption,
  },
  actionRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: space.lg,
  },
  actionLabel: {
    color: palette.brand,
    ...typography.bodyStrong,
  },
});
