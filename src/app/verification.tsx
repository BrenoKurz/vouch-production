import { useCallback, useState } from "react";
import * as Crypto from "expo-crypto";
import { Stack, useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ApiError, apiGet, apiPost } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import type {
  MemberVerification,
  StartVerificationEnvelope,
  StartVerificationRequest,
  VerificationEnvelope,
  VerificationState,
} from "@/types/verification";

const STATE_LABELS: Record<VerificationState, string> = {
  not_started: "Not started",
  pending: "In review",
  verified: "Verified",
  rejected: "Needs attention",
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string) {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value &&
    parsed.getTime() <= Date.now()
  );
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function stateTone(state: VerificationState) {
  switch (state) {
    case "verified":
      return styles.statusPositive;
    case "pending":
      return styles.statusPending;
    case "rejected":
      return styles.statusAttention;
    default:
      return styles.statusNeutral;
  }
}

export default function VerificationScreen() {
  const { session } = useAuth();
  const accessToken = session?.access_token;

  const [verification, setVerification] = useState<MemberVerification | null>(
    null,
  );
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadVerification = useCallback(async () => {
    if (!accessToken) {
      setErrorMessage("Your session has expired. Please sign in again.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await apiGet<VerificationEnvelope>(
        "/members/me/verification",
        accessToken,
      );

      setVerification(response.data);
      setDateOfBirth(response.data.date_of_birth ?? "");
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "We could not load your verification status.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useFocusEffect(
    useCallback(() => {
      void loadVerification();
    }, [loadVerification]),
  );

  async function handleStartVerification() {
    const normalizedDate = dateOfBirth.trim();

    if (!verification || !accessToken || isSubmitting) {
      return;
    }

    if (!isValidIsoDate(normalizedDate)) {
      setErrorMessage("Enter a valid date of birth in YYYY-MM-DD format.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const body: StartVerificationRequest = {
      date_of_birth: normalizedDate,
    };

    try {
      const response = await apiPost<
        StartVerificationEnvelope,
        StartVerificationRequest
      >("/members/me/verification", accessToken, body, Crypto.randomUUID(), {
        "If-Match": String(verification.version),
      });

      setVerification(response.data);
      setDateOfBirth(response.data.date_of_birth ?? normalizedDate);
    } catch (error) {
      if (error instanceof ApiError && error.code === "version_conflict") {
        setErrorMessage(
          "Your verification status changed. We refreshed it for you.",
        );
        await loadVerification();
      } else {
        setErrorMessage(
          error instanceof ApiError
            ? error.message
            : "We could not start verification.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: "Identity verification" }} />

      <SafeAreaView style={styles.screen}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.eyebrow}>MEMBERSHIP</Text>
            <Text style={styles.title}>Confirm you’re really you</Text>
            <Text style={styles.subtitle}>
              Verification confirms identity and age eligibility. Vouch stores
              the result—not identity documents or biometric source material.
            </Text>

            {isLoading && !verification ? (
              <View style={styles.centeredCard}>
                <ActivityIndicator color="#352D28" />
                <Text style={styles.loadingText}>
                  Loading verification status…
                </Text>
              </View>
            ) : null}

            {errorMessage ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {!isLoading && !verification ? (
              <Pressable
                onPress={() => void loadVerification()}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.primaryButtonText}>Try again</Text>
              </Pressable>
            ) : null}

            {verification ? (
              <>
                <View style={styles.statusCard}>
                  <View style={styles.statusHeader}>
                    <View>
                      <Text style={styles.cardLabel}>CURRENT STATUS</Text>
                      <Text style={styles.statusTitle}>
                        {STATE_LABELS[verification.verification_state]}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        stateTone(verification.verification_state),
                      ]}
                    >
                      <Text style={styles.statusBadgeText}>
                        {STATE_LABELS[verification.verification_state]}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.statusDescription}>
                    {verification.verification_state === "not_started"
                      ? "Provide your date of birth to begin the secure verification process."
                      : verification.verification_state === "pending"
                        ? "Your verification is in progress. We’ll update this screen when the provider returns a result."
                        : verification.verification_state === "verified"
                          ? "Your identity and age eligibility are confirmed."
                          : "Verification needs attention. Review the details below before trying again."}
                  </Text>
                </View>

                {verification.verification_state === "not_started" ? (
                  <View style={styles.formCard}>
                    <Text style={styles.inputLabel}>Date of birth</Text>
                    <TextInput
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isSubmitting}
                      keyboardType={
                        Platform.OS === "ios"
                          ? "numbers-and-punctuation"
                          : "numeric"
                      }
                      maxLength={10}
                      onChangeText={setDateOfBirth}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#A39A92"
                      style={styles.input}
                      value={dateOfBirth}
                    />
                    <Text style={styles.inputHelp}>
                      Use the date shown on your identity document.
                    </Text>

                    <Pressable
                      disabled={isSubmitting}
                      onPress={() => void handleStartVerification()}
                      style={({ pressed }) => [
                        styles.primaryButton,
                        isSubmitting && styles.disabled,
                        pressed && styles.pressed,
                      ]}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.primaryButtonText}>
                          Start verification
                        </Text>
                      )}
                    </Pressable>
                  </View>
                ) : null}

                {verification.latest_session ? (
                  <View style={styles.detailsCard}>
                    <Text style={styles.cardLabel}>LATEST CHECK</Text>
                    <DetailRow
                      label="Provider"
                      value={verification.latest_session.provider}
                    />
                    <DetailRow
                      label="Result"
                      value={verification.latest_session.status}
                    />
                    {verification.latest_session.reason_codes.length > 0 ? (
                      <DetailRow
                        label="Details"
                        value={verification.latest_session.reason_codes.join(
                          ", ",
                        )}
                      />
                    ) : null}
                    {verification.latest_session.verified_at ? (
                      <DetailRow
                        label="Verified"
                        value={
                          formatTimestamp(
                            verification.latest_session.verified_at,
                          ) ?? "—"
                        }
                        isLast
                      />
                    ) : null}
                  </View>
                ) : null}

                {verification.verification_state !== "not_started" ? (
                  <Pressable
                    disabled={isLoading}
                    onPress={() => void loadVerification()}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#352D28" />
                    ) : (
                      <Text style={styles.secondaryButtonText}>
                        Refresh status
                      </Text>
                    )}
                  </Pressable>
                ) : null}

                <View style={styles.privacyCard}>
                  <Text style={styles.privacyTitle}>Privacy by design</Text>
                  <Text style={styles.privacyText}>
                    Vouch never stores identity-document images, raw liveness
                    video, or biometric templates. Only the verification
                    outcome, provider reference, timestamps, and audit signals
                    are retained.
                  </Text>
                </View>
              </>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

function DetailRow({
  label,
  value,
  isLast = false,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.detailRow, isLast && styles.detailRowLast]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  screen: {
    backgroundColor: "#F7F4EF",
    flex: 1,
  },
  content: {
    paddingBottom: 48,
    paddingHorizontal: 22,
    paddingTop: 26,
  },
  eyebrow: {
    color: "#8A8179",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  title: {
    color: "#171717",
    fontSize: 32,
    fontWeight: "700",
    lineHeight: 39,
    marginTop: 8,
  },
  subtitle: {
    color: "#746D66",
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 24,
    marginTop: 10,
  },
  centeredCard: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#E3DDD6",
    borderRadius: 12,
    borderWidth: 1,
    padding: 24,
  },
  loadingText: {
    color: "#746D66",
    fontSize: 14,
    marginTop: 10,
  },
  errorCard: {
    backgroundColor: "#FFF0ED",
    borderColor: "#E3BEB7",
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 18,
    padding: 14,
  },
  errorText: {
    color: "#87483E",
    fontSize: 14,
    lineHeight: 20,
  },
  statusCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E3DDD6",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    padding: 18,
  },
  statusHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cardLabel: {
    color: "#8A8179",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  statusTitle: {
    color: "#292421",
    fontSize: 22,
    fontWeight: "700",
    marginTop: 6,
  },
  statusBadge: {
    borderRadius: 8,
    marginLeft: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusBadgeText: {
    color: "#352D28",
    fontSize: 11,
    fontWeight: "800",
  },
  statusDescription: {
    color: "#746D66",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 15,
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
  formCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E3DDD6",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    padding: 18,
  },
  inputLabel: {
    color: "#413A35",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#FAF8F5",
    borderColor: "#D8D0C8",
    borderRadius: 9,
    borderWidth: 1,
    color: "#292421",
    fontSize: 17,
    letterSpacing: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  inputHelp: {
    color: "#8A8179",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#352D28",
    borderRadius: 9,
    height: 50,
    justifyContent: "center",
    marginTop: 18,
    paddingHorizontal: 24,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#BEB6AE",
    borderRadius: 9,
    borderWidth: 1,
    height: 50,
    justifyContent: "center",
    marginBottom: 16,
  },
  secondaryButtonText: {
    color: "#352D28",
    fontSize: 15,
    fontWeight: "700",
  },
  detailsCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E3DDD6",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  detailRow: {
    borderBottomColor: "#ECE7E2",
    borderBottomWidth: 1,
    paddingVertical: 13,
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    color: "#8A8179",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  detailValue: {
    color: "#292421",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 5,
  },
  privacyCard: {
    backgroundColor: "#EEE8E1",
    borderRadius: 12,
    padding: 18,
  },
  privacyTitle: {
    color: "#352D28",
    fontSize: 15,
    fontWeight: "700",
  },
  privacyText: {
    color: "#625A54",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 7,
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.72,
  },
});
