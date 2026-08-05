import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import { type Href, useFocusEffect, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  AppScreen,
  ErrorState,
  LoadingState,
} from "@/components/vouch-ui";
import {
  layout,
  palette,
  radius,
  space,
  typography,
} from "@/constants/design";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import type { IntakeEnvelope, MemberIntake } from "@/types/intake";
import type {
  MemberProfile,
  MemberProfilePrompt,
  MembershipAction,
  MembershipActionRequest,
  MembershipEnvelope,
  ProfileEnvelope,
  ProfileIntakeState,
  ProfileVerificationState,
} from "@/types/profile";

const VERIFICATION_LABELS: Record<ProfileVerificationState, string> = {
  not_started: "Not started",
  pending: "In review",
  verified: "Verified",
  rejected: "Needs attention",
};

const INTAKE_LABELS: Record<ProfileIntakeState, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
};

function displayValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "Not provided";
  }

  return String(value);
}

function humanize(value: string | null | undefined) {
  if (!value) {
    return "Not provided";
  }

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function statusTone(state: ProfileVerificationState | ProfileIntakeState) {
  switch (state) {
    case "verified":
    case "completed":
      return styles.statusPositive;

    case "pending":
    case "in_progress":
      return styles.statusPending;

    case "rejected":
      return styles.statusAttention;

    default:
      return styles.statusNeutral;
  }
}

export default function ProfileScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();

  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [intake, setIntake] = useState<MemberIntake | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isChangingMembership, setIsChangingMembership] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadProfile = useCallback(
    async (refreshing = false) => {
      const accessToken = session?.access_token;

      if (!accessToken) {
        setProfile(null);
        setErrorMessage("Your session has expired. Please sign in again.");
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage(null);

      try {
        const [profileResult, intakeResult] = await Promise.allSettled([
          apiGet<ProfileEnvelope>("/members/me/profile", accessToken),
          apiGet<IntakeEnvelope>("/members/me/intake", accessToken),
        ]);

        if (profileResult.status === "rejected") {
          throw profileResult.reason;
        }

        setProfile(profileResult.value.data);
        if (intakeResult.status === "fulfilled") {
          setIntake(intakeResult.value.data);
        }
      } catch (error) {
        setErrorMessage(
          error instanceof ApiError
            ? error.message
            : "We could not load your profile.",
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [session?.access_token],
  );

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  async function handleSignOut() {
    setIsSigningOut(true);

    try {
      await signOut();
    } finally {
      setIsSigningOut(false);
    }
  }

  async function changeMembership(action: MembershipAction) {
    const accessToken = session?.access_token;

    if (!accessToken || !profile || isChangingMembership) {
      return;
    }

    setIsChangingMembership(true);
    setErrorMessage(null);

    try {
      const response = await apiPost<
        MembershipEnvelope,
        MembershipActionRequest
      >(
        "/members/me/membership",
        accessToken,
        { action },
        `membership-${action}-${profile.id}-${profile.version}`,
        { "If-Match": String(profile.version) },
      );

      setProfile(response.data);
    } catch (error) {
      if (error instanceof ApiError && error.code === "version_conflict") {
        setErrorMessage(
          "Your membership changed while this page was open. We refreshed the latest status.",
        );
        await loadProfile();
      } else {
        setErrorMessage(
          error instanceof ApiError
            ? error.message
            : "We could not update your membership.",
        );
      }
    } finally {
      setIsChangingMembership(false);
    }
  }

  function confirmMembershipAction(action: MembershipAction) {
    const content: Record<
      MembershipAction,
      { title: string; message: string; confirm: string }
    > = {
      pause: {
        title: "Pause new introductions?",
        message:
          "You will stop receiving new introductions. Existing connections remain available, and you can resume when you are ready.",
        confirm: "Pause membership",
      },
      resume: {
        title: "Resume introductions?",
        message:
          "Your membership will become active again and you can receive new curated introductions.",
        confirm: "Resume membership",
      },
      graduate: {
        title: "Graduate from Vouch?",
        message:
          "Choose this when you have found a relationship. Graduation is permanent for this membership cycle and requires all active connections to be complete.",
        confirm: "Graduate",
      },
    };
    const copy = content[action];

    Alert.alert(copy.title, copy.message, [
      { text: "Cancel", style: "cancel" },
      {
        text: copy.confirm,
        style: action === "graduate" ? "destructive" : "default",
        onPress: () => void changeMembership(action),
      },
    ]);
  }

  if (isLoading && !profile) {
    return (
      <AppScreen>
        <LoadingState label="Loading your private profile…" />
      </AppScreen>
    );
  }

  if (!profile) {
    return (
      <AppScreen>
        <ErrorState
          body={errorMessage ?? "We could not load your profile."}
          onRetry={() => void loadProfile()}
          title="Profile unavailable"
        />
      </AppScreen>
    );
  }

  const approvedPhoto = intake?.profile_photos.some(
    (photo) =>
      photo.screen_status === "pass" ||
      photo.screen_status === "override_pass",
  );
  const completedPromptCount = profile.prompts.filter((prompt) =>
    prompt.answer.trim(),
  ).length;
  const strengthSignals = [
    Boolean(profile.neighborhood),
    Boolean(profile.relationship_intent),
    Boolean(profile.seeking),
    Boolean(profile.dating_radius_miles),
    Boolean(profile.kids_status),
    Boolean(profile.kids_preference),
    approvedPhoto,
    completedPromptCount >= 1,
    completedPromptCount >= 2,
    completedPromptCount >= 3,
  ];
  const strengthScore = Math.round(
    (strengthSignals.filter(Boolean).length / strengthSignals.length) * 100,
  );
  const strengthSuggestions = [
    !approvedPhoto ? "Add an approved primary photo" : null,
    !profile.relationship_intent ? "Clarify your relationship goal" : null,
    !profile.seeking ? "Share who you would like to meet" : null,
    !profile.dating_radius_miles ? "Set a comfortable dating radius" : null,
    completedPromptCount < 3
      ? `Complete ${3 - completedPromptCount} more profile ${
          3 - completedPromptCount === 1 ? "prompt" : "prompts"
        }`
      : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <AppScreen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void loadProfile(true)}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>YOUR VOUCH PROFILE</Text>
            <Text style={styles.title}>{profile.first_name}</Text>

            <Text style={styles.subtitle}>
              {profile.age_display ? `${profile.age_display} · ` : ""}
              {profile.neighborhood ?? "Neighborhood not provided"}
            </Text>
          </View>

          <View
            style={[
              styles.headerStatus,
              statusTone(profile.verification_state),
            ]}
          >
            <Text style={styles.headerStatusText}>
              {VERIFICATION_LABELS[profile.verification_state]}
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/edit-profile")}
          style={({ pressed }) => [
            styles.editButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.editButtonText}>Edit profile</Text>
        </Pressable>

        <Pressable
          accessibilityHint="Opens your private profile photo manager"
          accessibilityRole="button"
          onPress={() => router.push("/profile-photos")}
          style={({ pressed }) => [
            styles.photoManager,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.photoManagerIcon}>
            <Ionicons
              color={palette.brand}
              name="camera-outline"
              size={24}
            />
          </View>
          <View style={styles.photoManagerCopy}>
            <Text style={styles.photoManagerTitle}>Profile photos</Text>
            <Text style={styles.photoManagerBody}>
              {approvedPhoto
                ? "Your primary photo is approved. Update it anytime."
                : intake?.profile_photos.length
                  ? "Your latest photo is in private review."
                  : "Add the photo members will see first."}
            </Text>
          </View>
          <View style={styles.photoManagerAction}>
            <Text style={styles.photoManagerActionText}>
              {intake?.profile_photos.length ? "Manage" : "Add"}
            </Text>
            <Ionicons
              color={palette.brand}
              name="chevron-forward"
              size={17}
            />
          </View>
        </Pressable>

        <Pressable
          accessibilityHint="Opens your optional AI matchmaking and data controls"
          accessibilityRole="button"
          onPress={() => router.push("/ai-matchmaker")}
          style={({ pressed }) => [
            styles.aiManager,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.photoManagerIcon}>
            <Ionicons
              color={palette.brand}
              name="sparkles-outline"
              size={24}
            />
          </View>
          <View style={styles.photoManagerCopy}>
            <Text style={styles.photoManagerTitle}>
              AI matchmaking controls
            </Text>
            <Text style={styles.photoManagerBody}>
              Choose whether AI may assist your human matchmaker and
              review exactly what stays private.
            </Text>
          </View>
          <View style={styles.photoManagerAction}>
            <Text style={styles.photoManagerActionText}>Review</Text>
            <Ionicons
              color={palette.brand}
              name="chevron-forward"
              size={17}
            />
          </View>
        </Pressable>

        {errorMessage ? (
          <View style={styles.warningCard}>
            <Text style={styles.warningText}>{errorMessage}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.strengthHeader}>
            <View style={styles.strengthCopy}>
              <Text style={styles.sectionTitle}>Profile strength</Text>
              <Text style={styles.strengthBody}>
                More complete profiles give your matchmaker better context and
                make introductions easier to trust.
              </Text>
            </View>
            <Text style={styles.strengthScore}>{strengthScore}%</Text>
          </View>
          <View
            accessibilityLabel={`Profile strength ${strengthScore} percent`}
            accessibilityRole="progressbar"
            accessibilityValue={{
              min: 0,
              max: 100,
              now: strengthScore,
            }}
            style={styles.strengthTrack}
          >
            <View
              style={[
                styles.strengthFill,
                { width: `${strengthScore}%` },
              ]}
            />
          </View>
          {strengthSuggestions.length ? (
            <View style={styles.suggestionList}>
              {strengthSuggestions.slice(0, 3).map((suggestion) => (
                <View key={suggestion} style={styles.suggestionRow}>
                  <Ionicons
                    color={palette.amber}
                    name="sparkles-outline"
                    size={16}
                  />
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.completeRow}>
              <Ionicons
                color={palette.sage}
                name="checkmark-circle"
                size={18}
              />
              <Text style={styles.completeText}>
                Your profile gives Vouch a rich, complete picture of you.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Membership progress</Text>

          <View style={styles.progressCard}>
            <Pressable
              accessibilityHint="Opens identity verification"
              accessibilityRole="button"
              onPress={() => router.push("/verification")}
              style={({ pressed }) => [
                styles.progressRow,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.progressCopy}>
                <Text style={styles.progressLabel}>Identity verification</Text>
                <Text style={styles.progressDescription}>
                  Confirms identity and age eligibility.
                </Text>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  statusTone(profile.verification_state),
                ]}
              >
                <Text style={styles.statusText}>
                  {VERIFICATION_LABELS[profile.verification_state]}
                </Text>
              </View>
            </Pressable>

            <View style={styles.divider} />

            <Pressable
              accessibilityHint="Opens matchmaking intake"
              accessibilityRole="button"
              onPress={() => router.push("/intake")}
              style={({ pressed }) => [
                styles.progressRow,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.progressCopy}>
                <Text style={styles.progressLabel}>Matchmaking intake</Text>
                <Text style={styles.progressDescription}>
                  Builds the private dossier used for introductions.
                </Text>
              </View>

              <View
                style={[styles.statusBadge, statusTone(profile.intake.state)]}
              >
                <Text style={styles.statusText}>
                  {INTAKE_LABELS[profile.intake.state]}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About you</Text>

          <View style={styles.card}>
            <ProfileField label="Email" value={session?.user.email ?? null} />
            <ProfileField
              label="Relationship intent"
              value={humanize(profile.relationship_intent)}
            />
            <ProfileField
              label="Interested in"
              value={humanize(profile.seeking)}
            />
            <ProfileField
              label="Neighborhood"
              value={displayValue(profile.neighborhood)}
            />
            <ProfileField
              label="Dating radius"
              value={
                profile.dating_radius_miles
                  ? `${profile.dating_radius_miles} miles`
                  : "Not provided"
              }
              isLast
            />
          </View>
        </View>

        {profile.intake.member_visible_summary ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your matchmaking summary</Text>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryText}>
                {profile.intake.member_visible_summary}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile prompts</Text>

          {profile.prompts.length > 0 ? (
            <View style={styles.promptList}>
              {profile.prompts.map((prompt: MemberProfilePrompt) => (
                <View key={prompt.id} style={styles.promptCard}>
                  <Text style={styles.promptQuestion}>{prompt.question}</Text>
                  <Text style={styles.promptAnswer}>
                    {prompt.answer || "No answer provided."}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No profile prompts yet</Text>
              <Text style={styles.emptyText}>
                Your prompts will appear here once your member profile is
                completed.
              </Text>
            </View>
          )}
        </View>

        {["active", "paused", "graduated"].includes(profile.status) ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Membership</Text>

            <View style={styles.membershipCard}>
              <Text style={styles.membershipStatus}>
                {humanize(profile.status)}
              </Text>
              <Text style={styles.membershipDescription}>
                {profile.status === "active"
                  ? "Your membership is active and eligible for curated introductions."
                  : profile.status === "graduated"
                    ? "Congratulations. Your Vouch membership cycle is complete."
                    : profile.membership_actions.includes("resume")
                      ? "New introductions are paused. Existing connections remain available."
                      : "Your membership is paused by Vouch. Contact support if you need help."}
              </Text>

              {profile.membership_actions.map((action) => (
                <Pressable
                  accessibilityRole="button"
                  disabled={isChangingMembership}
                  key={action}
                  onPress={() => confirmMembershipAction(action)}
                  style={({ pressed }) => [
                    styles.membershipButton,
                    action === "graduate" && styles.membershipButtonDestructive,
                    (pressed || isChangingMembership) && styles.pressed,
                  ]}
                >
                  {isChangingMembership ? (
                    <ActivityIndicator color={palette.brand} />
                  ) : (
                    <Text
                      style={[
                        styles.membershipButtonText,
                        action === "graduate" &&
                          styles.membershipButtonTextDestructive,
                      ]}
                    >
                      {action === "pause"
                        ? "Pause new introductions"
                        : action === "resume"
                          ? "Resume membership"
                          : "Graduate from Vouch"}
                    </Text>
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.accountCard}>
          <Text style={styles.accountTitle}>Account</Text>
          <Text style={styles.accountEmail}>{session?.user.email}</Text>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/account" as Href)}
            style={({ pressed }) => [
              styles.manageAccountButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.manageAccountText}>Account & settings</Text>
            <Ionicons color={palette.brand} name="chevron-forward" size={18} />
          </Pressable>

          <Pressable
            disabled={isSigningOut}
            onPress={handleSignOut}
            style={({ pressed }) => [
              styles.signOutButton,
              pressed && styles.pressed,
            ]}
          >
            {isSigningOut ? (
              <ActivityIndicator color={palette.brand} />
            ) : (
              <Text style={styles.signOutText}>Sign out</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </AppScreen>
  );
}

function ProfileField({
  label,
  value,
  isLast = false,
}: {
  label: string;
  value: string | number | null | undefined;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.fieldRow, isLast && styles.fieldRowLast]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{displayValue(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: palette.canvas,
    flex: 1,
  },
  content: {
    alignSelf: "center",
    maxWidth: layout.contentMaxWidth,
    paddingBottom: space.xxxl,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    width: "100%",
  },
  centered: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 30,
  },
  loadingText: {
    color: palette.muted,
    fontSize: 15,
    marginTop: 14,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  eyebrow: {
    color: palette.brand,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  title: {
    color: palette.ink,
    marginTop: 7,
    ...typography.title,
  },
  subtitle: {
    color: palette.muted,
    fontSize: 16,
    marginTop: 5,
  },
  headerStatus: {
    borderRadius: 8,
    marginLeft: 12,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  headerStatusText: {
    color: palette.ink,
    fontSize: 11,
    fontWeight: "800",
  },
  editButton: {
    alignItems: "center",
    backgroundColor: palette.brand,
    borderRadius: radius.sm,
    minHeight: 52,
    justifyContent: "center",
    marginBottom: 22,
  },
  editButtonText: {
    color: palette.white,
    fontSize: 15,
    fontWeight: "700",
  },
  photoManager: {
    alignItems: "center",
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: space.sm,
    marginBottom: space.xl,
    padding: space.md,
  },
  aiManager: {
    alignItems: "center",
    backgroundColor: palette.brandSoft,
    borderColor: palette.brandSoftStrong,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: space.sm,
    marginBottom: space.xl,
    marginTop: -space.sm,
    padding: space.md,
  },
  photoManagerIcon: {
    alignItems: "center",
    backgroundColor: palette.brandSoft,
    borderRadius: radius.sm,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  photoManagerCopy: {
    flex: 1,
  },
  photoManagerTitle: {
    color: palette.ink,
    ...typography.bodyStrong,
  },
  photoManagerBody: {
    color: palette.muted,
    marginTop: 2,
    ...typography.small,
  },
  photoManagerAction: {
    alignItems: "center",
    flexDirection: "row",
    gap: 2,
  },
  photoManagerActionText: {
    color: palette.brand,
    ...typography.caption,
  },
  warningCard: {
    backgroundColor: palette.amberSoft,
    borderColor: "#E6D5B5",
    borderRadius: radius.sm,
    borderWidth: 1,
    marginBottom: 20,
    padding: 14,
  },
  warningText: {
    color: palette.amber,
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    marginBottom: 26,
  },
  sectionTitle: {
    color: palette.ink,
    marginBottom: 11,
    ...typography.heading,
  },
  strengthHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: space.md,
    justifyContent: "space-between",
  },
  strengthCopy: {
    flex: 1,
  },
  strengthBody: {
    color: palette.muted,
    marginTop: -5,
    ...typography.small,
  },
  strengthScore: {
    color: palette.brand,
    fontFamily: "Georgia",
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 32,
  },
  strengthTrack: {
    backgroundColor: palette.canvasStrong,
    borderRadius: radius.pill,
    height: 9,
    marginTop: space.md,
    overflow: "hidden",
  },
  strengthFill: {
    backgroundColor: palette.sage,
    borderRadius: radius.pill,
    height: "100%",
  },
  suggestionList: {
    gap: space.xs,
    marginTop: space.md,
  },
  suggestionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.xs,
  },
  suggestionText: {
    color: palette.inkSoft,
    flex: 1,
    ...typography.small,
  },
  completeRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.xs,
    marginTop: space.md,
  },
  completeText: {
    color: palette.sage,
    flex: 1,
    ...typography.small,
  },
  progressCard: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 17,
  },
  progressRow: {
    alignItems: "center",
    flexDirection: "row",
  },
  progressCopy: {
    flex: 1,
    paddingRight: 12,
  },
  progressLabel: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "700",
  },
  progressDescription: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  divider: {
    backgroundColor: palette.border,
    height: 1,
    marginVertical: 17,
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  statusText: {
    color: palette.ink,
    fontSize: 11,
    fontWeight: "800",
  },
  statusPositive: {
    backgroundColor: palette.sageSoft,
  },
  statusPending: {
    backgroundColor: palette.amberSoft,
  },
  statusAttention: {
    backgroundColor: palette.dangerSoft,
  },
  statusNeutral: {
    backgroundColor: palette.canvasStrong,
  },
  card: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 17,
  },
  fieldRow: {
    borderBottomColor: palette.border,
    borderBottomWidth: 1,
    paddingVertical: 15,
  },
  fieldRowLast: {
    borderBottomWidth: 0,
  },
  fieldLabel: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  fieldValue: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "600",
    marginTop: 6,
  },
  summaryCard: {
    backgroundColor: palette.brandSoft,
    borderRadius: radius.md,
    padding: 18,
  },
  summaryText: {
    color: palette.inkSoft,
    fontSize: 15,
    lineHeight: 23,
  },
  promptList: {
    gap: 11,
  },
  promptCard: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 17,
  },
  promptQuestion: {
    color: palette.brand,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  promptAnswer: {
    color: palette.ink,
    fontSize: 16,
    lineHeight: 23,
    marginTop: 9,
  },
  emptyCard: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 18,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "700",
  },
  emptyText: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  accountCard: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 18,
  },
  manageAccountButton: {
    alignItems: "center",
    borderColor: palette.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: space.md,
    minHeight: 50,
    paddingHorizontal: space.md,
  },
  manageAccountText: {
    color: palette.ink,
    ...typography.bodyStrong,
  },
  membershipCard: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 18,
  },
  membershipStatus: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "700",
  },
  membershipDescription: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 7,
  },
  membershipButton: {
    alignItems: "center",
    borderColor: palette.borderStrong,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    marginTop: 14,
    paddingHorizontal: 16,
  },
  membershipButtonDestructive: {
    borderColor: palette.brandSoftStrong,
  },
  membershipButtonText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  membershipButtonTextDestructive: {
    color: palette.danger,
  },
  accountTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "700",
  },
  accountEmail: {
    color: palette.muted,
    fontSize: 14,
    marginTop: 6,
  },
  signOutButton: {
    alignItems: "center",
    borderColor: palette.borderStrong,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 50,
    justifyContent: "center",
    marginTop: 18,
  },
  signOutText: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "700",
  },
  errorTitle: {
    color: "#292421",
    fontSize: 22,
    fontWeight: "700",
  },
  errorText: {
    color: "#746D66",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 9,
    textAlign: "center",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#352D28",
    borderRadius: 9,
    height: 50,
    justifyContent: "center",
    marginTop: 22,
    paddingHorizontal: 28,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.72,
  },
});
