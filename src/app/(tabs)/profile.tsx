import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ApiError, apiGet } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import type {
  MemberProfile,
  MemberProfilePrompt,
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
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
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
        const response = await apiGet<ProfileEnvelope>(
          "/members/me/profile",
          accessToken,
        );

        setProfile(response.data);
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

  if (isLoading && !profile) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#352D28" />
          <Text style={styles.loadingText}>Loading your profile…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Profile unavailable</Text>
          <Text style={styles.errorText}>
            {errorMessage ?? "We could not load your profile."}
          </Text>

          <Pressable
            onPress={() => void loadProfile()}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
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
          onPress={() => router.push("/edit-profile")}
          style={({ pressed }) => [
            styles.editButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.editButtonText}>Edit profile</Text>
        </Pressable>

        {errorMessage ? (
          <View style={styles.warningCard}>
            <Text style={styles.warningText}>{errorMessage}</Text>
          </View>
        ) : null}

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

            <View style={styles.progressRow}>
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
            </View>
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

        <View style={styles.accountCard}>
          <Text style={styles.accountTitle}>Account</Text>
          <Text style={styles.accountEmail}>{session?.user.email}</Text>

          <Pressable
            disabled={isSigningOut}
            onPress={handleSignOut}
            style={({ pressed }) => [
              styles.signOutButton,
              pressed && styles.pressed,
            ]}
          >
            {isSigningOut ? (
              <ActivityIndicator color="#352D28" />
            ) : (
              <Text style={styles.signOutText}>Sign out</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
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
    backgroundColor: "#F7F4EF",
    flex: 1,
  },
  content: {
    paddingBottom: 48,
    paddingHorizontal: 22,
    paddingTop: 22,
  },
  centered: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 30,
  },
  loadingText: {
    color: "#746D66",
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
    color: "#8A8179",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  title: {
    color: "#171717",
    fontSize: 34,
    fontWeight: "700",
    marginTop: 7,
  },
  subtitle: {
    color: "#746D66",
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
    color: "#352D28",
    fontSize: 11,
    fontWeight: "800",
  },
  editButton: {
    alignItems: "center",
    backgroundColor: "#352D28",
    borderRadius: 9,
    height: 50,
    justifyContent: "center",
    marginBottom: 22,
  },
  editButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  warningCard: {
    backgroundColor: "#FFF4DE",
    borderColor: "#E7D1A6",
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 20,
    padding: 14,
  },
  warningText: {
    color: "#765A24",
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    marginBottom: 26,
  },
  sectionTitle: {
    color: "#352D28",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.3,
    marginBottom: 11,
  },
  progressCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E3DDD6",
    borderRadius: 12,
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
    color: "#292421",
    fontSize: 15,
    fontWeight: "700",
  },
  progressDescription: {
    color: "#7A726B",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  divider: {
    backgroundColor: "#ECE7E2",
    height: 1,
    marginVertical: 17,
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  statusText: {
    color: "#352D28",
    fontSize: 11,
    fontWeight: "800",
  },
  statusPositive: {
    backgroundColor: "#DCEBDD",
  },
  statusPending: {
    backgroundColor: "#F4E7C9",
  },
  statusAttention: {
    backgroundColor: "#F3D8D4",
  },
  statusNeutral: {
    backgroundColor: "#E9E5E1",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E3DDD6",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 17,
  },
  fieldRow: {
    borderBottomColor: "#ECE7E2",
    borderBottomWidth: 1,
    paddingVertical: 15,
  },
  fieldRowLast: {
    borderBottomWidth: 0,
  },
  fieldLabel: {
    color: "#847B73",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  fieldValue: {
    color: "#292421",
    fontSize: 15,
    fontWeight: "600",
    marginTop: 6,
  },
  summaryCard: {
    backgroundColor: "#EEE8E1",
    borderRadius: 12,
    padding: 18,
  },
  summaryText: {
    color: "#433C37",
    fontSize: 15,
    lineHeight: 23,
  },
  promptList: {
    gap: 11,
  },
  promptCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E3DDD6",
    borderRadius: 12,
    borderWidth: 1,
    padding: 17,
  },
  promptQuestion: {
    color: "#81776F",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  promptAnswer: {
    color: "#292421",
    fontSize: 16,
    lineHeight: 23,
    marginTop: 9,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E3DDD6",
    borderRadius: 12,
    borderWidth: 1,
    padding: 18,
  },
  emptyTitle: {
    color: "#292421",
    fontSize: 15,
    fontWeight: "700",
  },
  emptyText: {
    color: "#7A726B",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  accountCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E3DDD6",
    borderRadius: 12,
    borderWidth: 1,
    padding: 18,
  },
  accountTitle: {
    color: "#292421",
    fontSize: 16,
    fontWeight: "700",
  },
  accountEmail: {
    color: "#746D66",
    fontSize: 14,
    marginTop: 6,
  },
  signOutButton: {
    alignItems: "center",
    borderColor: "#BEB6AE",
    borderRadius: 9,
    borderWidth: 1,
    height: 50,
    justifyContent: "center",
    marginTop: 18,
  },
  signOutText: {
    color: "#352D28",
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
