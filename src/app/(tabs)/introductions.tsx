import { Ionicons } from "@expo/vector-icons";
import type { Href } from "expo-router";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  AppScreen,
  EmptyState,
  ErrorState,
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
  Introduction,
  IntroductionState,
  IntroductionsEnvelope,
} from "@/types/introduction";

const states: Record<
  IntroductionState,
  { label: string; tone: StatusTone }
> = {
  awaiting_your_response: { label: "Your response", tone: "warning" },
  accepted_waiting: { label: "Waiting for them", tone: "brand" },
  mutual_ready: { label: "Mutual interest", tone: "positive" },
  conversation_open: { label: "Conversation open", tone: "positive" },
  date_proposed: { label: "Date proposed", tone: "warning" },
  date_confirmed: { label: "Date confirmed", tone: "positive" },
  debrief_pending: { label: "Debrief ready", tone: "warning" },
  completed: { label: "Completed", tone: "neutral" },
  passed: { label: "Passed", tone: "neutral" },
  timed_out: { label: "Timed out", tone: "neutral" },
  kind_closed: { label: "Closed with care", tone: "neutral" },
  expired: { label: "Expired", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

function priority(item: Introduction) {
  if (item.member_state === "awaiting_your_response") return 0;
  if (item.member_state === "debrief_pending") return 1;
  if (item.member_state === "date_proposed") return 2;
  if (item.member_state === "accepted_waiting") return 3;
  return 4;
}

function formatDeadline(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function IntroductionsScreen() {
  const { session, signOut } = useAuth();
  const accessToken = session?.access_token;
  const [items, setItems] = useState<Introduction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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
      if (!accessToken) return;

      if (refreshing) setIsRefreshing(true);
      else setIsLoading(true);
      setErrorMessage("");

      try {
        const response = await apiGet<IntroductionsEnvelope>(
          "/introductions",
          accessToken,
        );
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
            : "Unable to load your introductions.",
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
        <LoadingState label="Gathering your introductions…" />
      </AppScreen>
    );
  }

  if (errorMessage && items.length === 0) {
    return (
      <AppScreen>
        <ErrorState
          body={errorMessage}
          onRetry={() => void load()}
          title="Your introductions are still private"
        />
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
          <PageHeader
            eyebrow="CURATED FOR YOU"
            subtitle="Each introduction is selected by people who understand your private profile."
            title="Introductions"
          />
        }
        ListEmptyComponent={
          <EmptyState
            body="There is nothing to review right now. We’ll notify you when a considered introduction is ready."
            icon="sparkles-outline"
            title="We’re looking thoughtfully"
          />
        }
        refreshControl={
          <RefreshControl
            onRefresh={() => void load(true)}
            refreshing={isRefreshing}
            tintColor={palette.brand}
          />
        }
        renderItem={({ item }) => <IntroductionCard item={item} />}
        showsVerticalScrollIndicator={false}
      />
    </AppScreen>
  );
}

function IntroductionCard({ item }: { item: Introduction }) {
  const photo = item.profile_snapshot.photos[0]?.url;
  const prompt = item.profile_snapshot.prompts[0];
  const deadline = formatDeadline(item.response_deadline_at);
  const state = states[item.member_state];
  const hasConversation = Boolean(
    item.conversation_id &&
      item.available_actions.includes("open_conversation"),
  );

  function open() {
    router.push(
      {
        pathname: "/introduction/[id]",
        params: { id: item.id },
      } as Href,
    );
  }

  return (
    <Pressable
      accessibilityHint={
        hasConversation
          ? "Opens this introduction and its conversation"
          : "Opens the full introduction"
      }
      accessibilityLabel={`Introduction to ${item.profile_snapshot.first_name}, ${state.label}`}
      accessibilityRole="button"
      onPress={open}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.photoWrap}>
        {photo ? (
          <Image
            accessibilityLabel={`${item.profile_snapshot.first_name}'s profile photo`}
            source={{ uri: photo }}
            style={styles.photo}
          />
        ) : (
          <View style={[styles.photo, styles.photoPlaceholder]}>
            <Text style={styles.initial}>
              {item.profile_snapshot.first_name.slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.photoBadge}>
          <StatusPill label={state.label} tone={state.tone} />
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.nameRow}>
          <View style={styles.nameCopy}>
            <Text style={styles.name}>
              {item.profile_snapshot.first_name},{" "}
              {item.profile_snapshot.age_display}
            </Text>
            <View style={styles.locationRow}>
              <Ionicons
                color={palette.muted}
                name="location-outline"
                size={15}
              />
              <Text style={styles.neighborhood}>
                {item.profile_snapshot.neighborhood}
              </Text>
            </View>
          </View>
          <View style={styles.openIcon}>
            <Ionicons
              color={palette.brand}
              name="arrow-forward"
              size={19}
            />
          </View>
        </View>

        <View style={styles.sourceRow}>
          <Ionicons
            color={palette.sage}
            name={
              item.introduction_note.source === "ai_assisted"
                ? "sparkles-outline"
                : "people-outline"
            }
            size={15}
          />
          <Text style={styles.sourceText}>
            {item.introduction_note.source === "ai_assisted"
              ? "AI-assisted · reviewed by a Vouch matchmaker"
              : "Selected by a Vouch matchmaker"}
          </Text>
        </View>

        {item.introduction_note.body ? (
          <View style={styles.noteBlock}>
            <Text style={styles.noteLabel}>WHY VOUCH INTRODUCED YOU</Text>
            <Text numberOfLines={4} style={styles.note}>
              “{item.introduction_note.body}”
            </Text>
          </View>
        ) : null}

        {prompt ? (
          <View style={styles.prompt}>
            <Text style={styles.promptQuestion}>{prompt.question}</Text>
            <Text numberOfLines={3} style={styles.promptAnswer}>
              {prompt.answer}
            </Text>
          </View>
        ) : null}

        {deadline ? (
          <View style={styles.deadlineRow}>
            <Ionicons
              color={palette.amber}
              name="time-outline"
              size={16}
            />
            <Text style={styles.deadline}>Respond by {deadline}</Text>
          </View>
        ) : null}
      </View>
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
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: space.lg,
    overflow: "hidden",
    ...shadow,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.995 }],
  },
  photoWrap: {
    position: "relative",
  },
  photo: {
    aspectRatio: 1.22,
    backgroundColor: palette.canvasStrong,
    width: "100%",
  },
  photoPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  initial: {
    color: palette.brand,
    fontFamily: "Georgia",
    fontSize: 58,
    fontWeight: "700",
  },
  photoBadge: {
    bottom: space.md,
    left: space.md,
    position: "absolute",
  },
  cardBody: {
    padding: space.lg,
  },
  nameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.md,
    justifyContent: "space-between",
  },
  nameCopy: {
    flex: 1,
  },
  name: {
    color: palette.ink,
    ...typography.heading,
  },
  locationRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 3,
    marginTop: space.xxs,
  },
  neighborhood: {
    color: palette.muted,
    ...typography.small,
  },
  openIcon: {
    alignItems: "center",
    backgroundColor: palette.brandSoft,
    borderRadius: radius.pill,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  sourceRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.xs,
    marginTop: space.md,
  },
  sourceText: {
    color: palette.sage,
    flex: 1,
    ...typography.caption,
  },
  noteBlock: {
    backgroundColor: palette.brandSoft,
    borderRadius: radius.sm,
    marginTop: space.lg,
    padding: space.md,
  },
  noteLabel: {
    color: palette.brand,
    ...typography.label,
  },
  note: {
    color: palette.inkSoft,
    fontFamily: "Georgia",
    fontSize: 16,
    fontStyle: "italic",
    lineHeight: 24,
    marginTop: space.xs,
  },
  prompt: {
    borderTopColor: palette.border,
    borderTopWidth: 1,
    marginTop: space.lg,
    paddingTop: space.md,
  },
  promptQuestion: {
    color: palette.muted,
    ...typography.label,
  },
  promptAnswer: {
    color: palette.ink,
    marginTop: space.xs,
    ...typography.body,
  },
  deadlineRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: space.md,
  },
  deadline: {
    color: palette.amber,
    ...typography.caption,
  },
});
