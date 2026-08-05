import { Ionicons } from "@expo/vector-icons";
import * as Crypto from "expo-crypto";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import {
  AppButton,
  AppScreen,
  ErrorState,
  LoadingState,
  StackHeader,
  StatusPill,
} from "@/components/vouch-ui";
import {
  layout,
  palette,
  radius,
  space,
  typography,
} from "@/constants/design";
import { ApiError, apiGet, apiPatch } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import type {
  AiMatchmakingPreferences,
  AiMatchmakingPreferencesEnvelope,
  AiMatchmakingPreferencesUpdateEnvelope,
  AiMatchmakingPreferencesUpdateRequest,
} from "@/types/ai-matchmaking";

export default function AiMatchmakerScreen() {
  const { session, signOut } = useAuth();
  const accessToken = session?.access_token;
  const [preferences, setPreferences] =
    useState<AiMatchmakingPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!accessToken) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const response = await apiGet<AiMatchmakingPreferencesEnvelope>(
        "/members/me/ai-matchmaking",
        accessToken,
      );
      setPreferences(response.data);
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.status === 401 ||
          error.code === "authentication_required")
      ) {
        await signOut();
        return;
      }

      setMessage(
        error instanceof Error
          ? error.message
          : "We could not load your AI matchmaking controls.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, signOut]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function save(
    enabled: boolean,
    debriefLearningEnabled: boolean,
  ) {
    if (!accessToken || !preferences || isSaving) return;

    setIsSaving(true);
    setMessage("");

    const body: AiMatchmakingPreferencesUpdateRequest = {
      enabled,
      debrief_learning_enabled:
        enabled && debriefLearningEnabled,
    };

    try {
      const response =
        await apiPatch<
          AiMatchmakingPreferencesUpdateEnvelope,
          AiMatchmakingPreferencesUpdateRequest
        >(
          "/members/me/ai-matchmaking",
          accessToken,
          body,
          Crypto.randomUUID(),
          { "If-Match": String(preferences.version) },
        );

      setPreferences(response.data);
      setMessage(
        response.data.enabled
          ? "Your AI matchmaking choice is saved."
          : "AI-assisted matching is off.",
      );
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === "version_conflict"
      ) {
        await load();
        setMessage(
          "Your settings changed while this page was open. We refreshed them.",
        );
      } else if (
        error instanceof ApiError &&
        (error.status === 401 ||
          error.code === "authentication_required")
      ) {
        await signOut();
      } else {
        setMessage(
          error instanceof Error
            ? error.message
            : "We could not save your choice.",
        );
      }
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading && !preferences) {
    return (
      <AppScreen includeBottomInset>
        <StackHeader title="AI matchmaking" />
        <LoadingState label="Loading your private controls…" />
      </AppScreen>
    );
  }

  if (!preferences) {
    return (
      <AppScreen includeBottomInset>
        <StackHeader title="AI matchmaking" />
        <ErrorState
          body={
            message ||
            "We could not load your AI matchmaking controls."
          }
          onRetry={() => void load()}
          title="Controls unavailable"
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen includeBottomInset>
      <StackHeader title="AI matchmaking" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons
              color={palette.brand}
              name="sparkles"
              size={25}
            />
          </View>
          <StatusPill
            label={
              preferences.enabled
                ? "AI assistance on"
                : "AI assistance off"
            }
            tone={preferences.enabled ? "positive" : "neutral"}
          />
          <Text style={styles.title}>More context, less swiping</Text>
          <Text style={styles.heroBody}>
            When you opt in, Vouch can use AI to help a human
            matchmaker find a small number of reciprocal,
            explainable introductions. It never delivers a match by
            itself.
          </Text>
        </View>

        <View style={styles.controlCard}>
          <PreferenceRow
            body="Allow Vouch to compare the approved matchmaking dossiers of other opted-in members and create a shortlist for staff review."
            disabled={isSaving}
            label="AI-assisted matchmaking"
            onValueChange={(value) =>
              void save(
                value,
                value &&
                  preferences.debrief_learning_enabled,
              )
            }
            value={preferences.enabled}
          />
          <View style={styles.divider} />
          <PreferenceRow
            body="Optionally use only structured outcomes, such as whether a date happened and whether you wanted another. Private debrief notes stay excluded."
            disabled={!preferences.enabled || isSaving}
            label="Learn from date outcomes"
            onValueChange={(value) =>
              void save(preferences.enabled, value)
            }
            value={
              preferences.enabled &&
              preferences.debrief_learning_enabled
            }
          />
        </View>

        {message ? (
          <View
            style={[
              styles.messageCard,
              message.includes("could not") &&
                styles.messageCardError,
            ]}
          >
            <Text style={styles.messageText}>{message}</Text>
          </View>
        ) : null}

        <PrivacySection
          icon="checkmark-circle-outline"
          title="What it may use"
          items={[
            "Your approved relationship goals, preferences, constraints, and practical dating context.",
            "The same approved dossier facts a Vouch matchmaker already uses.",
            "Structured date outcomes only when you turn on the separate learning control.",
          ]}
        />

        <PrivacySection
          icon="shield-checkmark-outline"
          title="What stays out"
          items={[
            "Private chats and message content.",
            "Photos, identity documents, safety reports, and blocked-member information.",
            "Private debrief notes or inferred sensitive traits.",
          ]}
        />

        <PrivacySection
          icon="people-outline"
          title="Human control"
          items={[
            "A Vouch matchmaker reviews both people, checks risks, and edits the note.",
            "Members see when AI assisted, and every delivered note is human-reviewed.",
            "Compatibility scores stay internal because chemistry is not a percentage.",
          ]}
        />

        <View style={styles.correctionCard}>
          <View style={styles.sectionHeading}>
            <Ionicons color={palette.brand} name="options-outline" size={21} />
            <Text style={styles.sectionTitle}>Your compatibility map</Text>
          </View>
          <Text style={styles.correctionBody}>
            Vouch keeps true dealbreakers separate from preferences, values,
            and practical context. You can review and correct every approved
            matchmaking fact whenever life changes.
          </Text>
          <AppButton
            label="Review matchmaking facts"
            onPress={() => router.push("/intake")}
            variant="secondary"
          />
        </View>

        <View style={styles.footerCard}>
          <Text style={styles.footerTitle}>
            Your choice is reversible
          </Text>
          <Text style={styles.footerBody}>
            Turn AI matchmaking off at any time. Existing
            introductions remain available, but your dossier will no
            longer be considered in new AI-assisted searches.
          </Text>
          <AppButton
            disabled={isSaving}
            label={
              preferences.enabled
                ? "Turn off AI matchmaking"
                : "Turn on AI matchmaking"
            }
            loading={isSaving}
            onPress={() =>
              void save(
                !preferences.enabled,
                false,
              )
            }
            variant={
              preferences.enabled ? "secondary" : "primary"
            }
          />
        </View>
      </ScrollView>
    </AppScreen>
  );
}

function PreferenceRow({
  label,
  body,
  value,
  disabled,
  onValueChange,
}: {
  label: string;
  body: string;
  value: boolean;
  disabled: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.preferenceRow}>
      <View style={styles.preferenceCopy}>
        <Text style={styles.preferenceLabel}>{label}</Text>
        <Text style={styles.preferenceBody}>{body}</Text>
      </View>
      <Switch
        accessibilityLabel={label}
        accessibilityRole="switch"
        disabled={disabled}
        ios_backgroundColor={palette.canvasStrong}
        onValueChange={onValueChange}
        thumbColor={palette.white}
        trackColor={{
          false: palette.borderStrong,
          true: palette.sage,
        }}
        value={value}
      />
    </View>
  );
}

function PrivacySection({
  icon,
  title,
  items,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  items: string[];
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <Ionicons color={palette.brand} name={icon} size={21} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionCard}>
        {items.map((item, index) => (
          <View
            key={item}
            style={[
              styles.itemRow,
              index === items.length - 1 && styles.itemRowLast,
            ]}
          >
            <View style={styles.itemDot} />
            <Text style={styles.itemText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    alignSelf: "center",
    maxWidth: layout.contentMaxWidth,
    paddingBottom: space.xxxl,
    paddingHorizontal: space.lg,
    width: "100%",
  },
  hero: {
    alignItems: "flex-start",
    paddingBottom: space.xl,
    paddingTop: space.md,
  },
  heroIcon: {
    alignItems: "center",
    backgroundColor: palette.brandSoft,
    borderRadius: radius.md,
    height: 52,
    justifyContent: "center",
    marginBottom: space.md,
    width: 52,
  },
  title: {
    color: palette.ink,
    marginTop: space.md,
    ...typography.title,
  },
  heroBody: {
    color: palette.inkSoft,
    marginTop: space.sm,
    ...typography.body,
  },
  controlCard: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.md,
  },
  preferenceRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.md,
    paddingVertical: space.md,
  },
  preferenceCopy: {
    flex: 1,
  },
  preferenceLabel: {
    color: palette.ink,
    ...typography.bodyStrong,
  },
  preferenceBody: {
    color: palette.muted,
    marginTop: space.xxs,
    ...typography.small,
  },
  divider: {
    backgroundColor: palette.border,
    height: 1,
  },
  messageCard: {
    backgroundColor: palette.sageSoft,
    borderRadius: radius.sm,
    marginTop: space.md,
    padding: space.sm,
  },
  messageCardError: {
    backgroundColor: palette.dangerSoft,
  },
  messageText: {
    color: palette.inkSoft,
    ...typography.small,
  },
  section: {
    marginTop: space.xl,
  },
  sectionHeading: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.xs,
    marginBottom: space.sm,
  },
  sectionTitle: {
    color: palette.ink,
    ...typography.heading,
  },
  sectionCard: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.md,
  },
  itemRow: {
    alignItems: "flex-start",
    borderBottomColor: palette.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: space.sm,
    paddingVertical: space.md,
  },
  itemRowLast: {
    borderBottomWidth: 0,
  },
  itemDot: {
    backgroundColor: palette.sage,
    borderRadius: radius.pill,
    height: 7,
    marginTop: 7,
    width: 7,
  },
  itemText: {
    color: palette.inkSoft,
    flex: 1,
    ...typography.small,
  },
  footerCard: {
    backgroundColor: palette.brandSoft,
    borderColor: palette.brandSoftStrong,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: space.sm,
    marginTop: space.xl,
    padding: space.lg,
  },
  correctionCard: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: space.sm,
    marginTop: space.xl,
    padding: space.lg,
  },
  correctionBody: {
    color: palette.inkSoft,
    marginBottom: space.xs,
    ...typography.small,
  },
  footerTitle: {
    color: palette.ink,
    ...typography.heading,
  },
  footerBody: {
    color: palette.inkSoft,
    marginBottom: space.xs,
    ...typography.small,
  },
});
