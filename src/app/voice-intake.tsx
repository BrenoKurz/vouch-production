import { Ionicons } from "@expo/vector-icons";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import * as Crypto from "expo-crypto";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  AppButton,
  AppScreen,
  Card,
  InlineNotice,
  StackHeader,
  StatusPill,
} from "@/components/vouch-ui";
import {
  layout,
  palette,
  radius,
  shadow,
  space,
  typography,
} from "@/constants/design";
import { ApiError, apiDelete, apiGet, apiPost } from "@/lib/api";
import {
  deleteLocalVoiceRecording,
  uploadAndProcessVoiceIntake,
} from "@/lib/voice-intake";
import { useAuth } from "@/providers/auth-provider";
import type {
  ConfirmVoiceIntakeEnvelope,
  ConfirmVoiceIntakeRequest,
  DiscardVoiceIntakeEnvelope,
  VoiceIntakeAnswers,
  VoiceIntakeReflection,
  VoiceIntakeStatusEnvelope,
} from "@/types/voice-intake";

const MAX_RECORDING_SECONDS = 180;
const MIN_RECORDING_SECONDS = 15;

type VoiceDraft = {
  relationship_goal: string;
  partner_qualities: string;
  dealbreakers: string;
  values: string;
  communication_style: string;
  typical_availability: string;
  location_preferences: string;
  matchmaker_notes: string;
};

const EMPTY_DRAFT: VoiceDraft = {
  relationship_goal: "",
  partner_qualities: "",
  dealbreakers: "",
  values: "",
  communication_style: "",
  typical_availability: "",
  location_preferences: "",
  matchmaker_notes: "",
};

function draftFromAnswers(answers: VoiceIntakeAnswers | null): VoiceDraft {
  if (!answers) return EMPTY_DRAFT;
  return {
    relationship_goal: answers.relationship_goal ?? "",
    partner_qualities: answers.partner_qualities.join(", "),
    dealbreakers: answers.dealbreakers.join(", "),
    values: answers.values.join(", "),
    communication_style: answers.communication_style ?? "",
    typical_availability: answers.typical_availability ?? "",
    location_preferences: answers.location_preferences ?? "",
    matchmaker_notes: answers.matchmaker_notes ?? "",
  };
}

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item, index, all) => {
      if (!item) return false;
      return (
        all.findIndex(
          (candidate) => candidate.toLowerCase() === item.toLowerCase(),
        ) === index
      );
    })
    .slice(0, 8);
}

function answersFromDraft(draft: VoiceDraft): VoiceIntakeAnswers {
  const optional = (value: string) => value.trim() || null;
  return {
    relationship_goal: optional(draft.relationship_goal),
    partner_qualities: parseList(draft.partner_qualities),
    dealbreakers: parseList(draft.dealbreakers),
    values: parseList(draft.values),
    communication_style: optional(draft.communication_style),
    typical_availability: optional(draft.typical_availability),
    location_preferences: optional(draft.location_preferences),
    matchmaker_notes: optional(draft.matchmaker_notes),
  };
}

function formatDuration(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function VoiceIntakeScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const accessToken = session?.access_token;

  const [providerAvailable, setProviderAvailable] = useState<boolean | null>(
    null,
  );
  const [reflection, setReflection] = useState<VoiceIntakeReflection | null>(
    null,
  );
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [recordedDurationMillis, setRecordedDurationMillis] = useState(0);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [draft, setDraft] = useState<VoiceDraft>(EMPTY_DRAFT);
  const [isLoading, setIsLoading] = useState(true);
  const [isStopping, setIsStopping] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY, (status) => {
    if (status.isFinished && status.url) {
      setRecordedUri(status.url);
      setRecordedDurationMillis(
        (current) => current || MAX_RECORDING_SECONDS * 1000,
      );
      void setAudioModeAsync({ allowsRecording: false });
    }
  });
  const recorderState = useAudioRecorderState(recorder, 250);

  const player = useAudioPlayer(recordedUri);
  const playerStatus = useAudioPlayerStatus(player);

  const loadVoiceIntake = useCallback(async () => {
    if (!accessToken) {
      setErrorMessage("Your session has expired. Please sign in again.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await apiGet<VoiceIntakeStatusEnvelope>(
        "/members/me/intake/voice",
        accessToken,
      );
      setProviderAvailable(response.data.provider_available);
      setReflection(response.data.reflection);
      if (response.data.reflection?.status === "ready_for_review") {
        setDraft(draftFromAnswers(response.data.reflection.suggested_answers));
      }
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "We could not load voice-assisted intake.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useFocusEffect(
    useCallback(() => {
      void loadVoiceIntake();
    }, [loadVoiceIntake]),
  );

  useEffect(
    () => () => {
      deleteLocalVoiceRecording(recordedUri);
    },
    [recordedUri],
  );

  const isReviewing = reflection?.status === "ready_for_review";
  const displayedDurationMillis = recordedUri
    ? recordedDurationMillis
    : recorderState.durationMillis;
  const recordingSeconds = Math.floor(displayedDurationMillis / 1000);
  const canProcess =
    Boolean(recordedUri) &&
    recordingSeconds >= MIN_RECORDING_SECONDS &&
    !isProcessing;
  const progress = Math.min(1, recordingSeconds / MAX_RECORDING_SECONDS);

  const reviewFields = useMemo(
    () =>
      [
        ["relationship_goal", "Relationship goal", "What you want to build"],
        [
          "partner_qualities",
          "Partner qualities",
          "Separate ideas with commas",
        ],
        ["dealbreakers", "Dealbreakers", "Separate ideas with commas"],
        ["values", "Core values", "Separate ideas with commas"],
        ["communication_style", "Communication", "How you connect and repair"],
        ["typical_availability", "Availability", "When dating fits your life"],
        ["location_preferences", "Location", "Where you can comfortably date"],
        [
          "matchmaker_notes",
          "Helpful context",
          "Anything nuanced we should understand",
        ],
      ] as const,
    [],
  );

  async function startRecording() {
    if (!providerAvailable || !privacyAccepted || recorderState.isRecording)
      return;
    setErrorMessage(null);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setErrorMessage(
          "Microphone access is needed only while you choose to record this reflection.",
        );
        return;
      }

      player.pause();
      setRecordedUri(null);
      setRecordedDurationMillis(0);
      await setAudioModeAsync({
        allowsRecording: true,
        allowsBackgroundRecording: false,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record({ forDuration: MAX_RECORDING_SECONDS });
    } catch {
      setErrorMessage(
        "We could not start recording. Please try again or continue by text.",
      );
    }
  }

  async function stopRecording() {
    if (!recorderState.isRecording || isStopping) return;
    setIsStopping(true);
    try {
      setRecordedDurationMillis(recorderState.durationMillis);
      await recorder.stop();
      setRecordedUri(recorder.uri);
      await setAudioModeAsync({ allowsRecording: false });
    } catch {
      setErrorMessage("We could not finish that recording. Please try again.");
    } finally {
      setIsStopping(false);
    }
  }

  async function processRecording() {
    if (!accessToken || !recordedUri || !canProcess) return;
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const response = await uploadAndProcessVoiceIntake({
        accessToken,
        uri: recordedUri,
      });
      setReflection(response.data);
      setDraft(draftFromAnswers(response.data.suggested_answers));
      setRecordedUri(null);
      setRecordedDurationMillis(0);
    } catch (error) {
      setRecordedUri(null);
      setRecordedDurationMillis(0);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We could not create suggestions. Your text intake is still available.",
      );
    } finally {
      setIsProcessing(false);
    }
  }

  async function confirmSuggestions() {
    if (!accessToken || !reflection || !isReviewing || isConfirming) return;
    setIsConfirming(true);
    setErrorMessage(null);
    const body: ConfirmVoiceIntakeRequest = {
      answers: answersFromDraft(draft),
    };

    try {
      await apiPost<ConfirmVoiceIntakeEnvelope, ConfirmVoiceIntakeRequest>(
        `/members/me/intake/voice/${encodeURIComponent(reflection.id)}/confirm`,
        accessToken,
        body,
        Crypto.randomUUID(),
      );
      router.back();
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "We could not save your review.",
      );
    } finally {
      setIsConfirming(false);
    }
  }

  async function discardReflection() {
    if (!accessToken || !reflection || isDiscarding) return;
    setIsDiscarding(true);
    setErrorMessage(null);
    try {
      await apiDelete<DiscardVoiceIntakeEnvelope>(
        `/members/me/intake/voice/${encodeURIComponent(reflection.id)}`,
        accessToken,
        Crypto.randomUUID(),
      );
      setReflection(null);
      setDraft(EMPTY_DRAFT);
      setRecordedUri(null);
      setRecordedDurationMillis(0);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "We could not discard that reflection.",
      );
    } finally {
      setIsDiscarding(false);
    }
  }

  return (
    <AppScreen includeBottomInset>
      <StackHeader
        title="Reflect by voice"
        subtitle="Optional · up to 3 minutes"
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons color={palette.brand} name="mic-outline" size={27} />
            </View>
            <Text style={styles.eyebrow}>VOUCH VOICE</Text>
            <Text style={styles.title}>Say it naturally. Keep control.</Text>
            <Text style={styles.subtitle}>
              Talk through what you want, your values, communication,
              dealbreakers, and practical dating life. AI turns only what you
              say into suggestions you can edit.
            </Text>
          </View>

          {errorMessage ? (
            <InlineNotice message={errorMessage} tone="danger" />
          ) : null}

          {!isLoading && providerAvailable === false ? (
            <InlineNotice message="Voice suggestions are not connected yet. Your full text questionnaire remains available." />
          ) : null}

          {isReviewing && reflection ? (
            <>
              <Card style={styles.reviewIntro}>
                <View style={styles.rowBetween}>
                  <StatusPill label="Ready for your review" tone="brand" />
                  {reflection.raw_audio_deleted ? (
                    <StatusPill label="Audio deleted" tone="positive" />
                  ) : null}
                </View>
                <Text style={styles.cardTitle}>
                  Nothing is used automatically
                </Text>
                <Text style={styles.body}>
                  Compare these suggestions with what you meant. Change or
                  remove anything. Your transcript is deleted when you approve
                  or discard this review.
                </Text>
              </Card>

              {reflection.transcript ? (
                <Card>
                  <Text style={styles.fieldLabel}>WHAT WE HEARD</Text>
                  <Text style={styles.transcript}>{reflection.transcript}</Text>
                </Card>
              ) : null}

              <Card style={styles.fieldsCard}>
                <Text style={styles.cardTitle}>Review every suggestion</Text>
                {reviewFields.map(([field, label, help]) => (
                  <View key={field} style={styles.field}>
                    <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
                    <Text style={styles.fieldHelp}>{help}</Text>
                    <TextInput
                      accessibilityLabel={label}
                      maxLength={field === "matchmaker_notes" ? 2000 : 700}
                      multiline
                      onChangeText={(value) =>
                        setDraft((current) => ({ ...current, [field]: value }))
                      }
                      placeholder="Not mentioned — leave blank"
                      placeholderTextColor={palette.subtle}
                      style={styles.input}
                      textAlignVertical="top"
                      value={draft[field]}
                    />
                  </View>
                ))}

                <AppButton
                  label="Use my reviewed answers"
                  loading={isConfirming}
                  onPress={() => void confirmSuggestions()}
                />
                <AppButton
                  label="Discard this reflection"
                  loading={isDiscarding}
                  onPress={() => void discardReflection()}
                  variant="danger"
                />
              </Card>
            </>
          ) : (
            <>
              <Card>
                <Text style={styles.cardTitle}>Before you record</Text>
                <View style={styles.promptList}>
                  {[
                    "The relationship and shared life you want",
                    "Qualities, values, and true dealbreakers",
                    "How you communicate and handle conflict",
                    "Your schedule, location, and useful nuance",
                  ].map((prompt) => (
                    <View key={prompt} style={styles.promptRow}>
                      <Ionicons
                        color={palette.sage}
                        name="checkmark-circle"
                        size={19}
                      />
                      <Text style={styles.promptText}>{prompt}</Text>
                    </View>
                  ))}
                </View>
              </Card>

              <Card style={styles.privacyCard}>
                <View style={styles.privacyHeading}>
                  <Ionicons
                    color={palette.brand}
                    name="shield-checkmark-outline"
                    size={22}
                  />
                  <Text style={styles.cardTitle}>
                    Private processing consent
                  </Text>
                </View>
                <Text style={styles.body}>
                  If you continue, Vouch sends this recording to OpenAI for
                  transcription and sends the transcript to OpenAI for
                  suggestion extraction. Provider storage is disabled. Vouch
                  deletes the audio immediately after transcription and the
                  transcript after your review. Voice is always optional.
                </Text>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: privacyAccepted }}
                  disabled={!providerAvailable}
                  onPress={() => setPrivacyAccepted((current) => !current)}
                  style={({ pressed }) => [
                    styles.consentRow,
                    pressed && styles.pressed,
                  ]}
                >
                  <View
                    style={[
                      styles.checkbox,
                      privacyAccepted && styles.checkboxChecked,
                    ]}
                  >
                    {privacyAccepted ? (
                      <Ionicons
                        color={palette.white}
                        name="checkmark"
                        size={17}
                      />
                    ) : null}
                  </View>
                  <Text style={styles.consentText}>
                    I understand and choose voice-assisted intake for this
                    recording.
                  </Text>
                </Pressable>
              </Card>

              <Card style={styles.recorderCard}>
                <View style={styles.rowBetween}>
                  <View>
                    <Text style={styles.fieldLabel}>PRIVATE REFLECTION</Text>
                    <Text style={styles.timer}>
                      {formatDuration(displayedDurationMillis)}
                    </Text>
                  </View>
                  <StatusPill
                    label={
                      recorderState.isRecording
                        ? "Recording"
                        : recordedUri
                          ? "Ready"
                          : "Not started"
                    }
                    tone={
                      recorderState.isRecording
                        ? "danger"
                        : recordedUri
                          ? "positive"
                          : "neutral"
                    }
                  />
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${progress * 100}%` },
                    ]}
                  />
                </View>
                <Text style={styles.timerHint}>
                  Minimum {MIN_RECORDING_SECONDS} seconds · maximum 3 minutes
                </Text>

                {recorderState.isRecording ? (
                  <AppButton
                    icon="stop-circle-outline"
                    label="Finish recording"
                    loading={isStopping}
                    onPress={() => void stopRecording()}
                    variant="secondary"
                  />
                ) : recordedUri ? (
                  <>
                    <AppButton
                      icon={
                        playerStatus.playing ? "pause-outline" : "play-outline"
                      }
                      label={
                        playerStatus.playing
                          ? "Pause recording"
                          : "Listen before sending"
                      }
                      onPress={() =>
                        playerStatus.playing ? player.pause() : player.play()
                      }
                      variant="secondary"
                    />
                    <AppButton
                      label="Create editable suggestions"
                      loading={isProcessing}
                      disabled={!canProcess}
                      onPress={() => void processRecording()}
                    />
                    <AppButton
                      label="Record again"
                      onPress={() => {
                        player.pause();
                        deleteLocalVoiceRecording(recordedUri);
                        setRecordedUri(null);
                        setRecordedDurationMillis(0);
                      }}
                      variant="ghost"
                    />
                  </>
                ) : (
                  <AppButton
                    icon="mic-outline"
                    label="Start private recording"
                    disabled={
                      !providerAvailable || !privacyAccepted || isLoading
                    }
                    onPress={() => void startRecording()}
                  />
                )}
              </Card>

              <AppButton
                label="Continue with text instead"
                onPress={() => router.back()}
                variant="ghost"
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    alignSelf: "center",
    gap: space.md,
    maxWidth: layout.contentMaxWidth,
    paddingBottom: space.xxl,
    paddingHorizontal: layout.gutter,
    paddingTop: space.sm,
    width: "100%",
  },
  hero: {
    alignItems: "center",
    paddingHorizontal: space.sm,
    paddingVertical: space.md,
  },
  heroIcon: {
    alignItems: "center",
    backgroundColor: palette.brandSoft,
    borderRadius: radius.pill,
    height: 56,
    justifyContent: "center",
    marginBottom: space.sm,
    width: 56,
  },
  eyebrow: {
    ...typography.label,
    color: palette.brand,
    marginBottom: space.xs,
  },
  title: { ...typography.title, color: palette.ink, textAlign: "center" },
  subtitle: {
    ...typography.body,
    color: palette.inkSoft,
    marginTop: space.sm,
    maxWidth: 580,
    textAlign: "center",
  },
  cardTitle: { ...typography.heading, color: palette.ink },
  body: { ...typography.small, color: palette.inkSoft },
  reviewIntro: { gap: space.sm },
  rowBetween: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.xs,
    justifyContent: "space-between",
  },
  transcript: {
    ...typography.body,
    color: palette.inkSoft,
    marginTop: space.sm,
  },
  fieldsCard: { gap: space.md },
  field: { gap: space.xs },
  fieldLabel: { ...typography.label, color: palette.brand },
  fieldHelp: { ...typography.caption, color: palette.muted },
  input: {
    ...typography.body,
    backgroundColor: palette.surfaceRaised,
    borderColor: palette.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: palette.ink,
    minHeight: 82,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
  },
  promptList: { gap: space.sm, marginTop: space.md },
  promptRow: { alignItems: "flex-start", flexDirection: "row", gap: space.sm },
  promptText: { ...typography.small, color: palette.inkSoft, flex: 1 },
  privacyCard: {
    backgroundColor: palette.brandSoft,
    borderColor: palette.brandSoftStrong,
  },
  privacyHeading: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.sm,
    marginBottom: space.sm,
  },
  consentRow: {
    alignItems: "flex-start",
    borderTopColor: palette.brandSoftStrong,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: space.sm,
    marginTop: space.md,
    paddingTop: space.md,
  },
  checkbox: {
    alignItems: "center",
    backgroundColor: palette.surface,
    borderColor: palette.borderStrong,
    borderRadius: 6,
    borderWidth: 1,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  checkboxChecked: {
    backgroundColor: palette.brand,
    borderColor: palette.brand,
  },
  consentText: {
    ...typography.small,
    color: palette.ink,
    flex: 1,
    fontWeight: "700",
  },
  recorderCard: { gap: space.md, ...shadow },
  timer: {
    color: palette.ink,
    fontSize: 34,
    fontWeight: "700",
    lineHeight: 41,
    marginTop: 2,
  },
  progressTrack: {
    backgroundColor: palette.canvasStrong,
    borderRadius: radius.pill,
    height: 8,
    overflow: "hidden",
  },
  progressFill: {
    backgroundColor: palette.brand,
    borderRadius: radius.pill,
    height: 8,
  },
  timerHint: { ...typography.caption, color: palette.muted },
  pressed: { opacity: 0.72 },
});
