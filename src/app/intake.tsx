import { useCallback, useState } from "react";
import * as Crypto from "expo-crypto";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AppScreen, StackHeader } from "@/components/vouch-ui";
import { layout } from "@/constants/design";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import { uploadProfilePhoto } from "@/lib/profile-photos";
import { useAuth } from "@/providers/auth-provider";
import type {
  ApproveDossierEnvelope,
  ApproveDossierRequest,
  IntakeAnswers,
  IntakeDossier,
  IntakeEnvelope,
  IntakeProfilePhoto,
  MemberIntake,
  StartIntakeEnvelope,
  StartIntakeRequest,
  SubmitIntakeEnvelope,
  SubmitIntakeRequest,
} from "@/types/intake";

type IntakeDraft = {
  relationship_goal: string;
  partner_qualities: string;
  dealbreakers: string;
  values: string;
  communication_style: string;
  typical_availability: string;
  location_preferences: string;
  matchmaker_notes: string;
};

type DraftField = keyof IntakeDraft;
type DraftErrors = Partial<Record<DraftField | "answers", string>>;

const EMPTY_DRAFT: IntakeDraft = {
  relationship_goal: "",
  partner_qualities: "",
  dealbreakers: "",
  values: "",
  communication_style: "",
  typical_availability: "",
  location_preferences: "",
  matchmaker_notes: "",
};

const STATE_LABELS: Record<MemberIntake["intake_state"], string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Submitted",
};

type ActivationRequirementKey =
  keyof MemberIntake["activation"]["requirements"];

const ACTIVATION_REQUIREMENTS: {
  key: ActivationRequirementKey;
  label: string;
}[] = [
  { key: "admission_approved", label: "Application approved" },
  { key: "identity_verified", label: "Identity verified" },
  { key: "age_assurance_passed", label: "Age assurance passed" },
  { key: "profile_photo_approved", label: "Profile photo approved" },
  { key: "intake_completed", label: "Matchmaking intake complete" },
  { key: "membership_access_granted", label: "Membership access granted" },
];

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function duplicateFree(values: string[]) {
  const normalized = values.map((value) => value.toLocaleLowerCase());
  return new Set(normalized).size === normalized.length;
}

function validateDraft(draft: IntakeDraft): {
  answers: IntakeAnswers | null;
  errors: DraftErrors;
} {
  const errors: DraftErrors = {};
  const relationshipGoal = draft.relationship_goal.trim();
  const partnerQualities = parseList(draft.partner_qualities);
  const dealbreakers = parseList(draft.dealbreakers);
  const values = parseList(draft.values);
  const communicationStyle = draft.communication_style.trim();
  const typicalAvailability = draft.typical_availability.trim();
  const locationPreferences = draft.location_preferences.trim();
  const matchmakerNotes = draft.matchmaker_notes.trim();

  if (relationshipGoal.length < 10 || relationshipGoal.length > 500) {
    errors.relationship_goal = "Use 10–500 characters.";
  }

  if (
    partnerQualities.length < 1 ||
    partnerQualities.length > 8 ||
    partnerQualities.some((item) => item.length > 80) ||
    !duplicateFree(partnerQualities)
  ) {
    errors.partner_qualities = "Add 1–8 unique qualities, separated by commas.";
  }

  if (
    dealbreakers.length > 8 ||
    dealbreakers.some((item) => item.length > 80) ||
    !duplicateFree(dealbreakers)
  ) {
    errors.dealbreakers =
      "Add up to 8 unique dealbreakers, separated by commas.";
  }

  if (
    values.length < 1 ||
    values.length > 8 ||
    values.some((item) => item.length > 80) ||
    !duplicateFree(values)
  ) {
    errors.values = "Add 1–8 unique values, separated by commas.";
  }

  if (communicationStyle.length < 10 || communicationStyle.length > 500) {
    errors.communication_style = "Use 10–500 characters.";
  }

  if (typicalAvailability.length < 5 || typicalAvailability.length > 500) {
    errors.typical_availability = "Use 5–500 characters.";
  }

  if (locationPreferences.length < 5 || locationPreferences.length > 500) {
    errors.location_preferences = "Use 5–500 characters.";
  }

  if (matchmakerNotes.length < 20 || matchmakerNotes.length > 2000) {
    errors.matchmaker_notes = "Use 20–2,000 characters.";
  }

  if (Object.keys(errors).length > 0) {
    return { answers: null, errors };
  }

  return {
    answers: {
      relationship_goal: relationshipGoal,
      partner_qualities: partnerQualities,
      dealbreakers,
      values,
      communication_style: communicationStyle,
      typical_availability: typicalAvailability,
      location_preferences: locationPreferences,
      matchmaker_notes: matchmakerNotes,
    },
    errors,
  };
}

function apiFieldErrors(error: ApiError): DraftErrors {
  const result: DraftErrors = {};

  Object.entries(error.fieldErrors ?? {}).forEach(([field, messages]) => {
    const message = messages[0];

    if (message) {
      result[field as DraftField | "answers"] = message;
    }
  });

  return result;
}

export default function IntakeScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const accessToken = session?.access_token;

  const [intake, setIntake] = useState<MemberIntake | null>(null);
  const [draft, setDraft] = useState<IntakeDraft>(EMPTY_DRAFT);
  const [fieldErrors, setFieldErrors] = useState<DraftErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [dossierAccurate, setDossierAccurate] = useState(false);
  const [processingConsented, setProcessingConsented] = useState(false);

  const loadIntake = useCallback(async () => {
    if (!accessToken) {
      setErrorMessage("Your session has expired. Please sign in again.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await apiGet<IntakeEnvelope>(
        "/members/me/intake",
        accessToken,
      );

      setIntake(response.data);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "We could not load your matchmaking intake.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useFocusEffect(
    useCallback(() => {
      void loadIntake();
    }, [loadIntake]),
  );

  function updateDraft(field: DraftField, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleStart() {
    if (!accessToken || !intake || isStarting) {
      return;
    }

    setIsStarting(true);
    setErrorMessage(null);
    setFieldErrors({});

    const body: StartIntakeRequest = { modality: "text" };

    try {
      const response = await apiPost<StartIntakeEnvelope, StartIntakeRequest>(
        "/members/me/intake/sessions",
        accessToken,
        body,
        Crypto.randomUUID(),
        {
          "If-Match": String(intake.version),
        },
      );

      setIntake(response.data);
    } catch (error) {
      if (error instanceof ApiError && error.code === "version_conflict") {
        setErrorMessage(
          "Your membership changed. We refreshed your intake status.",
        );
        await loadIntake();
      } else {
        setErrorMessage(
          error instanceof ApiError
            ? error.message
            : "We could not start your matchmaking intake.",
        );
      }
    } finally {
      setIsStarting(false);
    }
  }

  async function handleSubmit() {
    if (!accessToken || !intake || !intake.latest_session || isSubmitting) {
      return;
    }

    const validation = validateDraft(draft);

    if (!validation.answers) {
      setFieldErrors(validation.errors);
      setErrorMessage("Check the highlighted answers.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setFieldErrors({});

    const body: SubmitIntakeRequest = {
      answers: validation.answers,
    };

    try {
      const response = await apiPost<SubmitIntakeEnvelope, SubmitIntakeRequest>(
        `/members/me/intake/sessions/${intake.latest_session.id}/submit`,
        accessToken,
        body,
        Crypto.randomUUID(),
        {
          "If-Match": String(intake.version),
        },
      );

      setIntake(response.data);
      setDraft(EMPTY_DRAFT);
    } catch (error) {
      if (error instanceof ApiError) {
        setFieldErrors(apiFieldErrors(error));

        if (error.code === "version_conflict") {
          setErrorMessage(
            "Your intake changed while you were editing. We refreshed its status.",
          );
          await loadIntake();
        } else {
          setErrorMessage(error.message);
        }
      } else {
        setErrorMessage("We could not submit your matchmaking intake.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleChoosePhoto() {
    if (
      !accessToken ||
      !intake ||
      intake.profile_photos.length > 0 ||
      isUploadingPhoto
    ) {
      return;
    }

    setIsUploadingPhoto(true);
    setErrorMessage(null);

    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setErrorMessage(
          "Allow photo-library access to choose a private profile photo.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [4, 5],
        mediaTypes: ["images"],
        quality: 0.85,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];

      if (!asset) {
        throw new Error("No profile photo was selected.");
      }

      const response = await uploadProfilePhoto({
        accessToken,
        asset: {
          uri: asset.uri,
          name: asset.fileName ?? `vouch-profile-${Date.now()}.jpg`,
          mimeType: asset.mimeType ?? null,
          size: asset.fileSize ?? null,
        },
        version: intake.version,
      });

      setIntake(response.data);
    } catch (error) {
      if (error instanceof ApiError && error.code === "version_conflict") {
        setErrorMessage(
          "Your membership changed. We refreshed your activation status.",
        );
        await loadIntake();
      } else {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "We could not upload your profile photo.",
        );
      }
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  async function handleApproveDossier() {
    if (
      !accessToken ||
      !intake ||
      !intake.activation.can_approve ||
      !dossierAccurate ||
      !processingConsented ||
      isApproving
    ) {
      return;
    }

    setIsApproving(true);
    setErrorMessage(null);

    const body: ApproveDossierRequest = {
      confirmations: {
        dossier_accurate: true,
        matchmaking_processing_consented: true,
      },
    };

    try {
      const response = await apiPost<
        ApproveDossierEnvelope,
        ApproveDossierRequest
      >(
        "/members/me/intake/dossier/approve",
        accessToken,
        body,
        Crypto.randomUUID(),
        {
          "If-Match": String(intake.version),
        },
      );

      setIntake(response.data);
      setDossierAccurate(false);
      setProcessingConsented(false);
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.code === "activation_gate_failed" ||
          error.code === "version_conflict")
      ) {
        setErrorMessage(
          error.code === "version_conflict"
            ? "Your membership changed. We refreshed your activation status."
            : "One activation requirement changed. Review the refreshed checklist.",
        );
        await loadIntake();
      } else {
        setErrorMessage(
          error instanceof ApiError
            ? error.message
            : "We could not approve your matchmaking dossier.",
        );
      }
    } finally {
      setIsApproving(false);
    }
  }

  const currentStatusLabel =
    intake?.activation.state === "active"
      ? "Active"
      : intake
        ? STATE_LABELS[intake.intake_state]
        : "";

  return (
      <AppScreen includeBottomInset>
        <StackHeader title="Matchmaking intake" />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.eyebrow}>YOUR MATCHMAKER</Text>
            <Text style={styles.title}>Tell us what matters</Text>
            <Text style={styles.subtitle}>
              Your answers create a private working dossier for Vouch
              matchmakers. They are not shown verbatim to potential matches.
            </Text>

            {isLoading && !intake ? (
              <View style={styles.centeredCard}>
                <ActivityIndicator color="#352D28" />
                <Text style={styles.loadingText}>Loading your intake…</Text>
              </View>
            ) : null}

            {errorMessage ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {!isLoading && !intake ? (
              <Pressable
                onPress={() => void loadIntake()}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.primaryButtonText}>Try again</Text>
              </Pressable>
            ) : null}

            {intake ? (
              <>
                <View style={styles.statusCard}>
                  <View>
                    <Text style={styles.cardLabel}>CURRENT STATUS</Text>
                    <Text style={styles.statusTitle}>{currentStatusLabel}</Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      intake.activation.state === "active" ||
                      intake.intake_state === "completed"
                        ? styles.statusPositive
                        : intake.intake_state === "in_progress"
                          ? styles.statusPending
                          : styles.statusNeutral,
                    ]}
                  >
                    <Text style={styles.statusBadgeText}>
                      {currentStatusLabel}
                    </Text>
                  </View>
                </View>

                {intake.intake_state === "not_started" && !intake.can_start ? (
                  <View style={styles.lockedCard}>
                    <Text style={styles.lockedTitle}>
                      Verification comes first
                    </Text>
                    <Text style={styles.lockedText}>
                      Once identity verification is complete, your matchmaking
                      questionnaire will unlock here.
                    </Text>

                    <Pressable
                      onPress={() => router.push("/verification")}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.secondaryButtonText}>
                        View verification
                      </Text>
                    </Pressable>
                  </View>
                ) : null}

                {intake.can_start ? (
                  <View style={styles.startCard}>
                    <Text style={styles.startTitle}>
                      About 10 thoughtful minutes
                    </Text>
                    <Text style={styles.startText}>
                      You’ll cover relationship goals, values, communication,
                      logistics, and what your matchmaker should understand
                      about you.
                    </Text>

                    <Pressable
                      disabled={isStarting}
                      onPress={() => void handleStart()}
                      style={({ pressed }) => [
                        styles.primaryButton,
                        isStarting && styles.disabled,
                        pressed && styles.pressed,
                      ]}
                    >
                      {isStarting ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.primaryButtonText}>
                          Begin questionnaire
                        </Text>
                      )}
                    </Pressable>
                  </View>
                ) : null}

                {intake.intake_state === "in_progress" ? (
                  <View style={styles.formCard}>
                    <Text style={styles.formTitle}>
                      Your matchmaking questionnaire
                    </Text>
                    <Text style={styles.formIntro}>
                      Be candid and specific. You’ll review the submitted
                      answers before they become part of active matchmaking.
                    </Text>

                    <QuestionField
                      error={fieldErrors.relationship_goal}
                      help="Describe the kind of relationship and shared life you want."
                      label="What are you looking to build?"
                      maxLength={500}
                      onChangeText={(value) =>
                        updateDraft("relationship_goal", value)
                      }
                      value={draft.relationship_goal}
                    />

                    <QuestionField
                      error={fieldErrors.partner_qualities}
                      help="Separate up to 8 qualities with commas."
                      label="Qualities you value in a partner"
                      maxLength={700}
                      onChangeText={(value) =>
                        updateDraft("partner_qualities", value)
                      }
                      value={draft.partner_qualities}
                    />

                    <QuestionField
                      error={fieldErrors.dealbreakers}
                      help="Optional. Separate up to 8 dealbreakers with commas."
                      label="True dealbreakers"
                      maxLength={700}
                      onChangeText={(value) =>
                        updateDraft("dealbreakers", value)
                      }
                      value={draft.dealbreakers}
                    />

                    <QuestionField
                      error={fieldErrors.values}
                      help="Separate up to 8 core values with commas."
                      label="Values that shape your life"
                      maxLength={700}
                      onChangeText={(value) => updateDraft("values", value)}
                      value={draft.values}
                    />

                    <QuestionField
                      error={fieldErrors.communication_style}
                      help="Share how you connect, repair conflict, and feel understood."
                      label="Your communication style"
                      maxLength={500}
                      onChangeText={(value) =>
                        updateDraft("communication_style", value)
                      }
                      value={draft.communication_style}
                    />

                    <QuestionField
                      error={fieldErrors.typical_availability}
                      help="Include realistic weeknight, weekend, travel, or parenting constraints."
                      label="Typical availability"
                      maxLength={500}
                      onChangeText={(value) =>
                        updateDraft("typical_availability", value)
                      }
                      value={draft.typical_availability}
                    />

                    <QuestionField
                      error={fieldErrors.location_preferences}
                      help="Tell us where you can comfortably date and travel."
                      label="Location preferences"
                      maxLength={500}
                      onChangeText={(value) =>
                        updateDraft("location_preferences", value)
                      }
                      value={draft.location_preferences}
                    />

                    <QuestionField
                      error={fieldErrors.matchmaker_notes}
                      help="Add context, nuance, or patterns a thoughtful matchmaker should know."
                      label="What else should your matchmaker understand?"
                      maxLength={2000}
                      onChangeText={(value) =>
                        updateDraft("matchmaker_notes", value)
                      }
                      value={draft.matchmaker_notes}
                    />

                    {fieldErrors.answers ? (
                      <Text style={styles.fieldError}>
                        {fieldErrors.answers}
                      </Text>
                    ) : null}

                    <Pressable
                      disabled={isSubmitting}
                      onPress={() => void handleSubmit()}
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
                          Submit to your matchmaker
                        </Text>
                      )}
                    </Pressable>
                  </View>
                ) : null}

                {intake.intake_state === "completed" && intake.dossier ? (
                  <>
                    <CompletedIntake dossier={intake.dossier} />
                    <ActivationCard
                      dossierAccurate={dossierAccurate}
                      intake={intake}
                      isApproving={isApproving}
                      isUploadingPhoto={isUploadingPhoto}
                      onApprove={() => void handleApproveDossier()}
                      onChoosePhoto={() => void handleChoosePhoto()}
                      onDossierAccurateChange={setDossierAccurate}
                      onProcessingConsentedChange={setProcessingConsented}
                      processingConsented={processingConsented}
                    />
                  </>
                ) : null}

                <View style={styles.privacyCard}>
                  <Text style={styles.privacyTitle}>Private by default</Text>
                  <Text style={styles.privacyText}>
                    This dossier is for Vouch matchmaking work. Other members
                    only see profile details and introduction context approved
                    for sharing.
                  </Text>
                </View>
              </>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </AppScreen>
  );
}

function QuestionField({
  error,
  help,
  label,
  maxLength,
  onChangeText,
  value,
}: {
  error?: string;
  help: string;
  label: string;
  maxLength: number;
  onChangeText: (value: string) => void;
  value: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        maxLength={maxLength}
        multiline
        onChangeText={onChangeText}
        placeholder="Write your answer…"
        placeholderTextColor="#A39A92"
        style={[styles.input, error && styles.inputError]}
        textAlignVertical="top"
        value={value}
      />
      <Text style={styles.inputHelp}>{error ?? help}</Text>
    </View>
  );
}

function CompletedIntake({ dossier }: { dossier: IntakeDossier }) {
  return (
    <View style={styles.completedCard}>
      <Text style={styles.completedEyebrow}>SUBMITTED FOR REVIEW</Text>
      <Text style={styles.completedTitle}>
        Your matchmaker has the full picture
      </Text>
      <Text style={styles.completedSummary}>
        {dossier.member_visible_summary}
      </Text>

      <SummarySection
        label="Relationship goal"
        value={dossier.relationship_goal}
      />
      <SummarySection
        label="Partner qualities"
        value={dossier.partner_qualities.join(" · ")}
      />
      <SummarySection label="Core values" value={dossier.values.join(" · ")} />
      {dossier.dealbreakers.length > 0 ? (
        <SummarySection
          label="Dealbreakers"
          value={dossier.dealbreakers.join(" · ")}
        />
      ) : null}
      <SummarySection
        label="Communication"
        value={dossier.communication_style}
      />
      <SummarySection
        label="Availability"
        value={dossier.typical_availability}
      />
      <SummarySection
        isLast
        label="Location"
        value={dossier.location_preferences}
      />
    </View>
  );
}

function photoReviewCopy(photo: IntakeProfilePhoto | undefined): {
  title: string;
  text: string;
  positive: boolean;
} {
  if (!photo) {
    return {
      title: "Add a profile photo",
      text: "Choose one clear, recent photo. It stays private while the Vouch team reviews it for your member profile.",
      positive: false,
    };
  }

  if (
    photo.screen_status === "pass" ||
    photo.screen_status === "override_pass"
  ) {
    return {
      title: "Profile photo approved",
      text: "Your photo passed review and is ready for your private member profile.",
      positive: true,
    };
  }

  if (photo.screen_status === "pending") {
    return {
      title: "Profile photo under review",
      text: "The Vouch team will review it before activation. You do not need to upload it again.",
      positive: false,
    };
  }

  return {
    title: "Profile photo needs attention",
    text: "Your matchmaker is reviewing the photo. The Vouch team will follow up if a different photo is needed.",
    positive: false,
  };
}

function ActivationCard({
  dossierAccurate,
  intake,
  isApproving,
  isUploadingPhoto,
  onApprove,
  onChoosePhoto,
  onDossierAccurateChange,
  onProcessingConsentedChange,
  processingConsented,
}: {
  dossierAccurate: boolean;
  intake: MemberIntake;
  isApproving: boolean;
  isUploadingPhoto: boolean;
  onApprove: () => void;
  onChoosePhoto: () => void;
  onDossierAccurateChange: (value: boolean) => void;
  onProcessingConsentedChange: (value: boolean) => void;
  processingConsented: boolean;
}) {
  if (intake.activation.state === "active") {
    return (
      <View style={styles.activeCard}>
        <Text style={styles.activeEyebrow}>MEMBERSHIP ACTIVE</Text>
        <Text style={styles.activeTitle}>You’re ready for introductions</Text>
        <Text style={styles.activeText}>
          Your approved dossier is now available to the Vouch team for
          thoughtful, human-led matchmaking.
        </Text>
      </View>
    );
  }

  const photo = intake.profile_photos[0];
  const photoCopy = photoReviewCopy(photo);
  const canSubmitApproval =
    intake.activation.can_approve &&
    dossierAccurate &&
    processingConsented &&
    !isApproving;

  return (
    <View style={styles.activationCard}>
      <Text style={styles.activationEyebrow}>ACTIVATION CHECKLIST</Text>
      <Text style={styles.activationTitle}>Complete your membership</Text>
      <Text style={styles.activationText}>
        Every requirement must be verified before your dossier can enter active
        matchmaking.
      </Text>

      <View style={styles.requirements}>
        {ACTIVATION_REQUIREMENTS.map((requirement) => {
          const complete = intake.activation.requirements[requirement.key];

          return (
            <View key={requirement.key} style={styles.requirementRow}>
              <View
                style={[
                  styles.requirementIcon,
                  complete && styles.requirementIconComplete,
                ]}
              >
                <Text
                  style={[
                    styles.requirementMark,
                    complete && styles.requirementMarkComplete,
                  ]}
                >
                  {complete ? "✓" : "·"}
                </Text>
              </View>
              <Text
                style={[
                  styles.requirementLabel,
                  complete && styles.requirementLabelComplete,
                ]}
              >
                {requirement.label}
              </Text>
            </View>
          );
        })}
      </View>

      <View
        style={[
          styles.photoCard,
          photoCopy.positive && styles.photoCardPositive,
        ]}
      >
        <Text style={styles.photoTitle}>{photoCopy.title}</Text>
        <Text style={styles.photoText}>{photoCopy.text}</Text>

        {!photo ? (
          <Pressable
            disabled={isUploadingPhoto}
            onPress={onChoosePhoto}
            style={({ pressed }) => [
              styles.secondaryButton,
              isUploadingPhoto && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            {isUploadingPhoto ? (
              <ActivityIndicator color="#352D28" />
            ) : (
              <Text style={styles.secondaryButtonText}>
                Choose profile photo
              </Text>
            )}
          </Pressable>
        ) : null}
      </View>

      {intake.activation.can_approve ? (
        <View style={styles.confirmationCard}>
          <Text style={styles.confirmationTitle}>Your final review</Text>
          <Text style={styles.confirmationIntro}>
            Review the submitted dossier above, then confirm both statements.
          </Text>

          <ConfirmationRow
            checked={dossierAccurate}
            label="I confirm this dossier accurately reflects the information I submitted."
            onChange={onDossierAccurateChange}
          />
          <ConfirmationRow
            checked={processingConsented}
            label="I consent to Vouch using my dossier and approved profile information for human matchmaking and introductions."
            onChange={onProcessingConsentedChange}
          />

          <Pressable
            disabled={!canSubmitApproval}
            onPress={onApprove}
            style={({ pressed }) => [
              styles.primaryButton,
              !canSubmitApproval && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            {isApproving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                Approve and activate membership
              </Text>
            )}
          </Pressable>
        </View>
      ) : (
        <Text style={styles.waitingText}>
          Vouch will unlock your final review automatically when every item is
          complete.
        </Text>
      )}
    </View>
  );
}

function ConfirmationRow({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [
        styles.confirmationRow,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        <Text style={styles.checkboxMark}>{checked ? "✓" : ""}</Text>
      </View>
      <Text style={styles.confirmationLabel}>{label}</Text>
    </Pressable>
  );
}

function SummarySection({
  isLast = false,
  label,
  value,
}: {
  isLast?: boolean;
  label: string;
  value: string;
}) {
  return (
    <View style={[styles.summarySection, isLast && styles.summarySectionLast]}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
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
    alignSelf: "center",
    maxWidth: layout.contentMaxWidth,
    paddingBottom: 48,
    paddingHorizontal: 22,
    paddingTop: 26,
    width: "100%",
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
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    borderColor: "#E3DDD6",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    padding: 18,
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
  statusPositive: {
    backgroundColor: "#DCEBDD",
  },
  statusPending: {
    backgroundColor: "#F4E7C9",
  },
  statusNeutral: {
    backgroundColor: "#E9E5E1",
  },
  lockedCard: {
    backgroundColor: "#EEE8E1",
    borderRadius: 12,
    marginBottom: 16,
    padding: 18,
  },
  lockedTitle: {
    color: "#352D28",
    fontSize: 18,
    fontWeight: "700",
  },
  lockedText: {
    color: "#625A54",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  startCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E3DDD6",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    padding: 18,
  },
  startTitle: {
    color: "#292421",
    fontSize: 18,
    fontWeight: "700",
  },
  startText: {
    color: "#746D66",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E3DDD6",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    padding: 18,
  },
  formTitle: {
    color: "#292421",
    fontSize: 21,
    fontWeight: "700",
  },
  formIntro: {
    color: "#746D66",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 22,
    marginTop: 8,
  },
  field: {
    marginBottom: 20,
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
    fontSize: 15,
    lineHeight: 21,
    minHeight: 104,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  inputError: {
    borderColor: "#B85C4D",
  },
  inputHelp: {
    color: "#8A8179",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
  },
  fieldError: {
    color: "#87483E",
    fontSize: 13,
    marginBottom: 10,
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
    borderColor: "#AFA59C",
    borderRadius: 9,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    marginTop: 16,
  },
  secondaryButtonText: {
    color: "#352D28",
    fontSize: 14,
    fontWeight: "700",
  },
  completedCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D8D0C8",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    padding: 18,
  },
  completedEyebrow: {
    color: "#5E795F",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  completedTitle: {
    color: "#292421",
    fontSize: 21,
    fontWeight: "700",
    lineHeight: 27,
    marginTop: 7,
  },
  completedSummary: {
    color: "#625A54",
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
    marginTop: 12,
  },
  summarySection: {
    borderBottomColor: "#ECE7E2",
    borderBottomWidth: 1,
    paddingVertical: 13,
  },
  summarySectionLast: {
    borderBottomWidth: 0,
  },
  summaryLabel: {
    color: "#8A8179",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  summaryValue: {
    color: "#292421",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 5,
  },
  activationCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D8D0C8",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    padding: 18,
  },
  activationEyebrow: {
    color: "#8A8179",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  activationTitle: {
    color: "#292421",
    fontSize: 21,
    fontWeight: "700",
    lineHeight: 27,
    marginTop: 7,
  },
  activationText: {
    color: "#625A54",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  requirements: {
    marginTop: 18,
  },
  requirementRow: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 11,
  },
  requirementIcon: {
    alignItems: "center",
    backgroundColor: "#EEE9E4",
    borderRadius: 10,
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  requirementIconComplete: {
    backgroundColor: "#DCEBDD",
  },
  requirementMark: {
    color: "#8A8179",
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 18,
  },
  requirementMarkComplete: {
    color: "#47694A",
    fontSize: 12,
  },
  requirementLabel: {
    color: "#746D66",
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    marginLeft: 10,
  },
  requirementLabelComplete: {
    color: "#3F5E42",
  },
  photoCard: {
    backgroundColor: "#F6F1EA",
    borderColor: "#E1D8CE",
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
    padding: 15,
  },
  photoCardPositive: {
    backgroundColor: "#EFF6EF",
    borderColor: "#CDDCCC",
  },
  photoTitle: {
    color: "#352D28",
    fontSize: 15,
    fontWeight: "700",
  },
  photoText: {
    color: "#625A54",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },
  confirmationCard: {
    borderTopColor: "#ECE7E2",
    borderTopWidth: 1,
    marginTop: 20,
    paddingTop: 18,
  },
  confirmationTitle: {
    color: "#292421",
    fontSize: 17,
    fontWeight: "700",
  },
  confirmationIntro: {
    color: "#746D66",
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 14,
    marginTop: 6,
  },
  confirmationRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    marginTop: 12,
  },
  checkbox: {
    alignItems: "center",
    borderColor: "#AFA59C",
    borderRadius: 5,
    borderWidth: 1,
    height: 22,
    justifyContent: "center",
    marginTop: 1,
    width: 22,
  },
  checkboxChecked: {
    backgroundColor: "#352D28",
    borderColor: "#352D28",
  },
  checkboxMark: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  confirmationLabel: {
    color: "#4F4842",
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    marginLeft: 11,
  },
  waitingText: {
    color: "#746D66",
    fontSize: 12,
    fontStyle: "italic",
    lineHeight: 18,
    marginTop: 16,
  },
  activeCard: {
    backgroundColor: "#EAF3EA",
    borderColor: "#C8D8C8",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    padding: 18,
  },
  activeEyebrow: {
    color: "#507253",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  activeTitle: {
    color: "#2F5033",
    fontSize: 21,
    fontWeight: "700",
    lineHeight: 27,
    marginTop: 7,
  },
  activeText: {
    color: "#49634B",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
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
