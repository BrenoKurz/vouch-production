import { Ionicons } from "@expo/vector-icons";
import type { Href } from "expo-router";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  AppButton,
  AppScreen,
  Avatar,
  Card,
  ContentColumn,
  ErrorState,
  IconButton,
  InlineNotice,
  LoadingState,
  SectionHeader,
  StatusPill,
  VouchWordmark,
} from "@/components/vouch-ui";
import {
  palette,
  radius,
  space,
  typography,
} from "@/constants/design";
import { ApiError, apiGet } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { useNotifications } from "@/providers/notification-provider";
import type {
  Introduction,
  IntroductionsEnvelope,
} from "@/types/introduction";
import type {
  DatesEnvelope,
  VouchDate,
} from "@/types/date";
import type {
  MemberProfile,
  ProfileEnvelope,
} from "@/types/profile";

type HomeData = {
  profile: MemberProfile | null;
  introductions: Introduction[];
  dates: VouchDate[];
};

type NextAction = {
  eyebrow: string;
  title: string;
  body: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  href: Href;
  tone: "brand" | "positive" | "warning";
};

const closedIntroductionStates = new Set<Introduction["member_state"]>([
  "completed",
  "passed",
  "timed_out",
  "kind_closed",
  "expired",
  "cancelled",
]);

function friendlyFirstName(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "there";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function isAuthError(error: unknown) {
  return (
    error instanceof ApiError &&
    (error.status === 401 || error.code === "authentication_required")
  );
}

function actionFor(
  profile: MemberProfile | null,
  introductions: Introduction[],
  dates: VouchDate[],
): NextAction {
  if (profile?.verification_state === "not_started") {
    return {
      eyebrow: "MEMBERSHIP SETUP",
      title: "Verify your identity",
      body: "A quick private verification confirms identity and age eligibility before introductions begin.",
      label: "Start verification",
      icon: "shield-checkmark-outline",
      href: "/verification",
      tone: "warning",
    };
  }

  if (profile?.verification_state === "rejected") {
    return {
      eyebrow: "NEEDS YOUR ATTENTION",
      title: "Review your verification",
      body: "Your latest verification needs an update before your membership can move forward.",
      label: "Review verification",
      icon: "alert-circle-outline",
      href: "/verification",
      tone: "warning",
    };
  }

  if (
    profile?.verification_state === "verified" &&
    profile.intake.state !== "completed"
  ) {
    return {
      eyebrow: "BUILD YOUR PRIVATE DOSSIER",
      title:
        profile.intake.state === "in_progress"
          ? "Continue your matchmaking intake"
          : "Tell us what matters to you",
      body: "Your private intake gives the Vouch team the context to make thoughtful introductions.",
      label:
        profile.intake.state === "in_progress"
          ? "Continue intake"
          : "Begin intake",
      icon: "create-outline",
      href: "/intake",
      tone: "warning",
    };
  }

  if (profile?.status === "paused") {
    return {
      eyebrow: "MEMBERSHIP PAUSED",
      title: "Take all the time you need",
      body: "New introductions are paused. Your existing connections remain available.",
      label: "View membership",
      icon: "pause-circle-outline",
      href: "/(tabs)/profile",
      tone: "brand",
    };
  }

  if (profile?.status === "graduated") {
    return {
      eyebrow: "A NEW CHAPTER",
      title: "You graduated from Vouch",
      body: "Your membership cycle is complete. We’re honored to have been part of your story.",
      label: "View your profile",
      icon: "heart-outline",
      href: "/(tabs)/profile",
      tone: "positive",
    };
  }

  const awaitingResponse = introductions.find(
    (item) => item.member_state === "awaiting_your_response",
  );

  if (awaitingResponse) {
    return {
      eyebrow: "A NEW INTRODUCTION",
      title: `Meet ${awaitingResponse.profile_snapshot.first_name}`,
      body:
        awaitingResponse.introduction_note.body ||
        "A thoughtful introduction is ready for you to consider.",
      label: "View introduction",
      icon: "sparkles-outline",
      href: {
        pathname: "/introduction/[id]",
        params: { id: awaitingResponse.id },
      },
      tone: "brand",
    };
  }

  const debriefDate = dates.find(
    (item) => item.can_complete_debrief && item.debrief_id,
  );

  if (debriefDate?.debrief_id) {
    return {
      eyebrow: "PRIVATE CHECK-IN",
      title: `How did it go with ${debriefDate.counterpart_profile.first_name}?`,
      body: "Share a private debrief with Vouch while the experience is still fresh.",
      label: "Complete debrief",
      icon: "chatbox-ellipses-outline",
      href: {
        pathname: "/debrief/[id]",
        params: { id: debriefDate.debrief_id },
      },
      tone: "warning",
    };
  }

  const proposedDate = dates.find((item) => item.can_confirm);

  if (proposedDate) {
    return {
      eyebrow: "DATE PROPOSAL",
      title: `Review your plan with ${proposedDate.counterpart_profile.first_name}`,
      body: `${formatDate(proposedDate.starts_at)} at ${formatTime(
        proposedDate.starts_at,
      )}${proposedDate.venue ? ` · ${proposedDate.venue.name}` : ""}`,
      label: "Review date",
      icon: "calendar-outline",
      href: {
        pathname: "/date/[id]",
        params: { id: proposedDate.id },
      },
      tone: "brand",
    };
  }

  const openConversation = introductions.find(
    (item) =>
      item.conversation_id &&
      item.available_actions.includes("open_conversation"),
  );

  if (openConversation?.conversation_id) {
    return {
      eyebrow: "YOUR CONNECTION",
      title: `Continue with ${openConversation.profile_snapshot.first_name}`,
      body: "Your private conversation is open. Take the next step when it feels right.",
      label: "Open conversation",
      icon: "chatbubble-outline",
      href: {
        pathname: "/conversation/[id]",
        params: { id: openConversation.conversation_id },
      },
      tone: "positive",
    };
  }

  return {
    eyebrow: "YOUR MEMBERSHIP",
    title: "We’re looking thoughtfully",
    body: "There is nothing you need to do right now. We’ll let you know when a considered introduction is ready.",
    label: "View introductions",
    icon: "search-outline",
    href: "/(tabs)/introductions",
    tone: "positive",
  };
}

export default function HomeScreen() {
  const { session, signOut } = useAuth();
  const { unreadCount, refreshUnreadCount } = useNotifications();
  const accessToken = session?.access_token;
  const [data, setData] = useState<HomeData>({
    profile: null,
    introductions: [],
    dates: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loadedAt, setLoadedAt] = useState(0);

  const load = useCallback(
    async (refreshing = false) => {
      if (!accessToken) return;

      if (refreshing) setIsRefreshing(true);
      else setIsLoading(true);
      setErrorMessage("");

      const results = await Promise.allSettled([
        apiGet<ProfileEnvelope>("/members/me/profile", accessToken),
        apiGet<IntroductionsEnvelope>("/introductions", accessToken),
        apiGet<DatesEnvelope>("/dates", accessToken),
        refreshUnreadCount(),
      ]);

      const authenticationFailure = results.find(
        (result) => result.status === "rejected" && isAuthError(result.reason),
      );

      if (authenticationFailure) {
        await signOut();
        return;
      }

      setData((current) => ({
        profile:
          results[0].status === "fulfilled"
            ? results[0].value.data
            : current.profile,
        introductions:
          results[1].status === "fulfilled"
            ? results[1].value.data
            : current.introductions,
        dates:
          results[2].status === "fulfilled"
            ? results[2].value.data
            : current.dates,
      }));

      const failedRequests = results.slice(0, 3).filter(
        (result) => result.status === "rejected",
      );

      if (failedRequests.length) {
        const firstError = failedRequests[0];
        setErrorMessage(
          firstError.status === "rejected" &&
            firstError.reason instanceof Error
            ? firstError.reason.message
            : "Some of your latest updates could not be loaded.",
        );
      }

      setIsLoading(false);
      setIsRefreshing(false);
      setLoadedAt(Date.now());
    },
    [accessToken, refreshUnreadCount, signOut],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const firstName = friendlyFirstName(
    data.profile?.first_name ??
      session?.user.user_metadata?.first_name ??
      session?.user.user_metadata?.display_name,
  );

  const activeIntroductions = useMemo(
    () =>
      data.introductions.filter(
        (item) => !closedIntroductionStates.has(item.member_state),
      ),
    [data.introductions],
  );

  const upcomingDate = useMemo(
    () =>
      [...data.dates]
        .filter(
          (item) =>
            (item.state === "confirmed" || item.state === "proposed") &&
            new Date(item.starts_at).getTime() > loadedAt,
        )
        .sort(
          (a, b) =>
            new Date(a.starts_at).getTime() -
            new Date(b.starts_at).getTime(),
        )[0],
    [data.dates, loadedAt],
  );

  const nextAction = useMemo(
    () => actionFor(data.profile, data.introductions, data.dates),
    [data],
  );

  if (isLoading && !data.profile) {
    return (
      <AppScreen>
        <ContentColumn style={styles.loadingColumn}>
          <VouchWordmark />
          <LoadingState label="Preparing your private member home…" />
        </ContentColumn>
      </AppScreen>
    );
  }

  if (!data.profile && errorMessage) {
    return (
      <AppScreen>
        <ContentColumn style={styles.loadingColumn}>
          <VouchWordmark />
          <ErrorState
            body={errorMessage}
            onRetry={() => void load()}
            title="Your home is temporarily unavailable"
          />
        </ContentColumn>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            onRefresh={() => void load(true)}
            refreshing={isRefreshing}
            tintColor={palette.brand}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <ContentColumn>
          <View style={styles.topBar}>
            <VouchWordmark />
            <IconButton
              accessibilityLabel={
                unreadCount
                  ? `Notifications, ${unreadCount} unread`
                  : "Notifications"
              }
              badge={unreadCount}
              icon="notifications-outline"
              onPress={() => router.push("/(tabs)/notifications")}
            />
          </View>

          <View style={styles.greeting}>
            <Text style={styles.greetingKicker}>YOUR PRIVATE MEMBER HOME</Text>
            <Text accessibilityRole="header" style={styles.greetingTitle}>
              Good to see you,{"\n"}
              <Text style={styles.greetingName}>{firstName}.</Text>
            </Text>
          </View>

          {errorMessage ? (
            <InlineNotice
              actionLabel="Refresh"
              message={`${errorMessage} Showing the latest available information.`}
              onAction={() => void load(true)}
            />
          ) : null}

          <NextActionCard action={nextAction} />

          {upcomingDate ? (
            <View style={styles.section}>
              <SectionHeader
                actionLabel="All dates"
                onAction={() => router.push("/(tabs)/dates")}
                title="Coming up"
              />
              <UpcomingDateCard item={upcomingDate} />
            </View>
          ) : null}

          <View style={styles.section}>
            <SectionHeader
              actionLabel="See all"
              onAction={() => router.push("/(tabs)/introductions")}
              title="Your connections"
            />

            <Card style={styles.connectionCard}>
              <View style={styles.connectionStat}>
                <Text style={styles.statValue}>{activeIntroductions.length}</Text>
                <Text style={styles.statLabel}>
                  {activeIntroductions.length === 1
                    ? "active connection"
                    : "active connections"}
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.connectionStat}>
                <Text style={styles.statValue}>
                  {
                    data.dates.filter((item) => item.state === "confirmed")
                      .length
                  }
                </Text>
                <Text style={styles.statLabel}>confirmed dates</Text>
              </View>
              <View style={styles.connectionArrow}>
                <Ionicons
                  color={palette.brand}
                  name="arrow-forward"
                  size={20}
                />
              </View>
            </Card>
          </View>

          <MembershipCard profile={data.profile} />

          <Pressable
            accessibilityHint="Opens your safety cases and reporting options"
            accessibilityRole="button"
            onPress={() => router.push("/safety-cases")}
            style={({ pressed }) => [
              styles.safetyLink,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.safetyIcon}>
              <Ionicons
                color={palette.sage}
                name="shield-checkmark-outline"
                size={21}
              />
            </View>
            <View style={styles.safetyCopy}>
              <Text style={styles.safetyTitle}>Safety and support</Text>
              <Text style={styles.safetyBody}>
                Private help is always available.
              </Text>
            </View>
            <Ionicons
              color={palette.subtle}
              name="chevron-forward"
              size={19}
            />
          </Pressable>
        </ContentColumn>
      </ScrollView>
    </AppScreen>
  );
}

function NextActionCard({ action }: { action: NextAction }) {
  const isPositive = action.tone === "positive";
  const isWarning = action.tone === "warning";

  return (
    <View
      style={[
        styles.hero,
        isPositive && styles.heroPositive,
        isWarning && styles.heroWarning,
      ]}
    >
      <View
        style={[
          styles.heroIcon,
          (isPositive || isWarning) && styles.heroIconLight,
        ]}
      >
        <Ionicons
          color={
            isPositive
              ? palette.sage
              : isWarning
                ? palette.amber
                : palette.white
          }
          name={action.icon}
          size={25}
        />
      </View>
      <Text
        style={[
          styles.heroEyebrow,
          (isPositive || isWarning) && styles.heroEyebrowDark,
        ]}
      >
        {action.eyebrow}
      </Text>
      <Text
        accessibilityRole="header"
        style={[
          styles.heroTitle,
          (isPositive || isWarning) && styles.heroTitleDark,
        ]}
      >
        {action.title}
      </Text>
      <Text
        numberOfLines={4}
        style={[
          styles.heroBody,
          (isPositive || isWarning) && styles.heroBodyDark,
        ]}
      >
        {action.body}
      </Text>
      <AppButton
        compact
        label={action.label}
        onPress={() => router.push(action.href)}
        style={styles.heroButton}
        variant={isPositive || isWarning ? "secondary" : "primary"}
      />
    </View>
  );
}

function UpcomingDateCard({ item }: { item: VouchDate }) {
  const profile = item.counterpart_profile;

  return (
    <Pressable
      accessibilityHint="Opens this date"
      accessibilityRole="button"
      onPress={() =>
        router.push({
          pathname: "/date/[id]",
          params: { id: item.id },
        })
      }
      style={({ pressed }) => [
        styles.upcomingCard,
        pressed && styles.pressed,
      ]}
    >
      <Avatar
        firstName={profile.first_name}
        size={66}
        uri={profile.photos[0]?.url}
      />
      <View style={styles.upcomingCopy}>
        <StatusPill
          label={item.state === "confirmed" ? "Confirmed" : "Proposed"}
          tone={item.state === "confirmed" ? "positive" : "warning"}
        />
        <Text style={styles.upcomingName}>
          {profile.first_name} · {formatDate(item.starts_at)}
        </Text>
        <Text style={styles.upcomingMeta}>
          {formatTime(item.starts_at)}
          {item.venue ? ` · ${item.venue.name}` : " · Venue to be decided"}
        </Text>
      </View>
      <Ionicons
        color={palette.subtle}
        name="chevron-forward"
        size={20}
      />
    </Pressable>
  );
}

function MembershipCard({ profile }: { profile: MemberProfile | null }) {
  const verificationComplete = profile?.verification_state === "verified";
  const intakeComplete = profile?.intake.state === "completed";
  const completed = Number(verificationComplete) + Number(intakeComplete);

  return (
    <View style={styles.section}>
      <SectionHeader
        actionLabel="Profile"
        onAction={() => router.push("/(tabs)/profile")}
        title="Your Vouch"
      />
      <Card>
        <View style={styles.membershipTop}>
          <View>
            <Text style={styles.membershipTitle}>Membership readiness</Text>
            <Text style={styles.membershipBody}>
              {completed === 2
                ? "Your private profile is ready for thoughtful matching."
                : `${completed} of 2 private setup steps complete.`}
            </Text>
          </View>
          <Text style={styles.membershipCount}>{completed}/2</Text>
        </View>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${(completed / 2) * 100}%` },
            ]}
          />
        </View>

        <View style={styles.setupSteps}>
          <SetupStep
            complete={verificationComplete}
            label="Identity"
            onPress={() => router.push("/verification")}
          />
          <SetupStep
            complete={intakeComplete}
            label="Private intake"
            onPress={() => router.push("/intake")}
          />
        </View>
      </Card>
    </View>
  );
}

function SetupStep({
  complete,
  label,
  onPress,
}: {
  complete: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.setupStep,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons
        color={complete ? palette.sage : palette.amber}
        name={complete ? "checkmark-circle" : "ellipse-outline"}
        size={19}
      />
      <Text style={styles.setupLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: space.xxxl,
    paddingHorizontal: space.lg,
  },
  loadingColumn: {
    flex: 1,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: space.sm,
  },
  greeting: {
    paddingBottom: space.xl,
    paddingTop: space.xxl,
  },
  greetingKicker: {
    color: palette.brand,
    ...typography.label,
  },
  greetingTitle: {
    color: palette.ink,
    marginTop: space.sm,
    ...typography.display,
  },
  greetingName: {
    color: palette.brand,
    fontFamily: "Georgia",
    fontStyle: "italic",
    fontWeight: "600",
  },
  hero: {
    backgroundColor: palette.brand,
    borderRadius: radius.lg,
    marginTop: space.md,
    overflow: "hidden",
    padding: space.xl,
  },
  heroPositive: {
    backgroundColor: palette.sageSoft,
    borderColor: "#C9DCD2",
    borderWidth: 1,
  },
  heroWarning: {
    backgroundColor: palette.amberSoft,
    borderColor: "#E6D5B5",
    borderWidth: 1,
  },
  heroIcon: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: radius.sm,
    height: 48,
    justifyContent: "center",
    marginBottom: space.xl,
    width: 48,
  },
  heroIconLight: {
    backgroundColor: "rgba(255,255,255,0.58)",
  },
  heroEyebrow: {
    color: "#F0DAD2",
    ...typography.label,
  },
  heroEyebrowDark: {
    color: palette.muted,
  },
  heroTitle: {
    color: palette.white,
    marginTop: space.xs,
    ...typography.title,
  },
  heroTitleDark: {
    color: palette.ink,
  },
  heroBody: {
    color: "#F7EDEA",
    marginTop: space.sm,
    maxWidth: 520,
    ...typography.body,
  },
  heroBodyDark: {
    color: palette.inkSoft,
  },
  heroButton: {
    marginTop: space.xl,
  },
  section: {
    marginTop: space.xxl,
  },
  upcomingCard: {
    alignItems: "center",
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: space.sm,
    padding: space.md,
  },
  upcomingCopy: {
    flex: 1,
  },
  upcomingName: {
    color: palette.ink,
    marginTop: space.xs,
    ...typography.bodyStrong,
  },
  upcomingMeta: {
    color: palette.muted,
    marginTop: 2,
    ...typography.small,
  },
  connectionCard: {
    alignItems: "center",
    flexDirection: "row",
    paddingVertical: space.lg,
  },
  connectionStat: {
    flex: 1,
  },
  statValue: {
    color: palette.brand,
    fontFamily: "Georgia",
    fontSize: 30,
    fontWeight: "700",
    lineHeight: 34,
  },
  statLabel: {
    color: palette.muted,
    marginTop: 2,
    ...typography.caption,
  },
  statDivider: {
    backgroundColor: palette.border,
    height: 46,
    marginHorizontal: space.md,
    width: 1,
  },
  connectionArrow: {
    alignItems: "center",
    backgroundColor: palette.brandSoft,
    borderRadius: radius.pill,
    height: 38,
    justifyContent: "center",
    marginLeft: space.sm,
    width: 38,
  },
  membershipTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: space.md,
    justifyContent: "space-between",
  },
  membershipTitle: {
    color: palette.ink,
    ...typography.bodyStrong,
  },
  membershipBody: {
    color: palette.muted,
    marginTop: space.xxs,
    maxWidth: 480,
    ...typography.small,
  },
  membershipCount: {
    color: palette.brand,
    fontSize: 20,
    fontWeight: "800",
  },
  progressTrack: {
    backgroundColor: palette.canvasStrong,
    borderRadius: radius.pill,
    height: 7,
    marginTop: space.lg,
    overflow: "hidden",
  },
  progressFill: {
    backgroundColor: palette.sage,
    borderRadius: radius.pill,
    height: "100%",
  },
  setupSteps: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
    marginTop: space.md,
  },
  setupStep: {
    alignItems: "center",
    backgroundColor: palette.canvas,
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: space.sm,
  },
  setupLabel: {
    color: palette.inkSoft,
    ...typography.caption,
  },
  safetyLink: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.sm,
    marginTop: space.xxl,
    paddingVertical: space.sm,
  },
  safetyIcon: {
    alignItems: "center",
    backgroundColor: palette.sageSoft,
    borderRadius: radius.sm,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  safetyCopy: {
    flex: 1,
  },
  safetyTitle: {
    color: palette.ink,
    ...typography.bodyStrong,
  },
  safetyBody: {
    color: palette.muted,
    ...typography.small,
  },
  pressed: {
    opacity: 0.76,
  },
});
