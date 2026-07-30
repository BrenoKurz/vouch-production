import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
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

import {
  AppScreen,
  InlineNotice,
  StackHeader,
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
  MemberProfile,
  MemberProfilePrompt,
  ProfileEnvelope,
  ProfileUpdateEnvelope,
  ProfileUpdateRequest,
} from "@/types/profile";

type PromptDraft = {
  id: string;
  question: string;
  answer: string;
};

type ChoiceOption = {
  label: string;
  value: string;
};

const RELATIONSHIP_INTENTS: ChoiceOption[] = [
  { label: "Life partner", value: "life_partner" },
  { label: "Long-term relationship", value: "long_term_relationship" },
  {
    label: "Long-term, open to short",
    value: "long_term_open_to_short",
  },
  { label: "Still figuring it out", value: "figuring_it_out" },
];

const SEEKING_OPTIONS: ChoiceOption[] = [
  { label: "Women", value: "women" },
  { label: "Men", value: "men" },
  { label: "Nonbinary people", value: "nonbinary_people" },
  { label: "Everyone", value: "everyone" },
];

const RADIUS_OPTIONS: ChoiceOption[] = [5, 10, 15, 25, 50, 100].map(
  (value) => ({
    label: `${value} mi`,
    value: String(value),
  }),
);

const KIDS_STATUS_OPTIONS: ChoiceOption[] = [
  { label: "Have children", value: "have_children" },
  { label: "No children", value: "no_children" },
  { label: "Prefer not to say", value: "prefer_not_to_say" },
];

const KIDS_PREFERENCE_OPTIONS: ChoiceOption[] = [
  { label: "Want children", value: "want_children" },
  { label: "Open to children", value: "open_to_children" },
  { label: "Do not want children", value: "do_not_want_children" },
  { label: "Not sure yet", value: "not_sure" },
];

const PROMPT_LIBRARY = [
  "A small thing that makes my week better is…",
  "The kind of relationship I want to build feels like…",
  "We’ll get along if…",
  "My ideal ordinary Sunday looks like…",
  "Something I’m genuinely curious about is…",
  "The quickest way to make me laugh is…",
  "A value I try to live by is…",
  "A green flag I notice right away is…",
  "A great first date would include…",
];

function createPromptDrafts(prompts: MemberProfilePrompt[]): PromptDraft[] {
  return Array.from({ length: 3 }, (_, index) => {
    const prompt = prompts[index];

    return {
      id: prompt?.id || `prompt-${index + 1}`,
      question: prompt?.question || "",
      answer: prompt?.answer || "",
    };
  });
}

function nullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeChoice(
  value: string | null,
  options: ChoiceOption[],
) {
  if (!value) {
    return "";
  }

  const normalized = value.trim().toLocaleLowerCase().replaceAll(" ", "_");
  const matchingOption = options.find(
    (option) =>
      option.value.toLocaleLowerCase() === normalized ||
      option.label.toLocaleLowerCase() === value.trim().toLocaleLowerCase(),
  );

  return matchingOption?.value ?? value;
}

export default function EditProfileScreen() {
  const router = useRouter();
  const { session } = useAuth();

  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [neighborhood, setNeighborhood] = useState("");
  const [relationshipIntent, setRelationshipIntent] = useState("");
  const [seeking, setSeeking] = useState("");
  const [datingRadius, setDatingRadius] = useState("");
  const [kidsStatus, setKidsStatus] = useState("");
  const [kidsPreference, setKidsPreference] = useState("");
  const [prompts, setPrompts] = useState<PromptDraft[]>(createPromptDrafts([]));

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const populateForm = useCallback((member: MemberProfile) => {
    setProfile(member);
    setNeighborhood(member.neighborhood ?? "");
    setRelationshipIntent(
      normalizeChoice(member.relationship_intent, RELATIONSHIP_INTENTS),
    );
    setSeeking(normalizeChoice(member.seeking, SEEKING_OPTIONS));
    setDatingRadius(
      member.dating_radius_miles === null
        ? ""
        : String(member.dating_radius_miles),
    );
    setKidsStatus(
      normalizeChoice(member.kids_status, KIDS_STATUS_OPTIONS),
    );
    setKidsPreference(
      normalizeChoice(member.kids_preference, KIDS_PREFERENCE_OPTIONS),
    );
    setPrompts(createPromptDrafts(member.prompts));
  }, []);

  const loadProfile = useCallback(async () => {
    const accessToken = session?.access_token;

    if (!accessToken) {
      setErrorMessage("Your session has expired. Please sign in again.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await apiGet<ProfileEnvelope>(
        "/members/me/profile",
        accessToken,
      );

      populateForm(response.data);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "We could not load your profile.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [populateForm, session?.access_token]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  function updatePrompt(
    index: number,
    field: "question" | "answer",
    value: string,
  ) {
    setPrompts((current) =>
      current.map((prompt, promptIndex) =>
        promptIndex === index ? { ...prompt, [field]: value } : prompt,
      ),
    );
  }

  function validate(): string | null {
    const textFields = [
      ["Neighborhood", neighborhood],
      ["Relationship intent", relationshipIntent],
      ["Interested in", seeking],
      ["Kids status", kidsStatus],
      ["Kids preference", kidsPreference],
    ] as const;

    for (const [label, value] of textFields) {
      if (value.trim().length > 120) {
        return `${label} must be 120 characters or fewer.`;
      }
    }

    if (datingRadius.trim()) {
      const radius = Number(datingRadius);

      if (!Number.isInteger(radius) || radius < 1 || radius > 100) {
        return "Dating radius must be a whole number from 1 to 100.";
      }
    }

    for (const prompt of prompts) {
      const question = prompt.question.trim();
      const answer = prompt.answer.trim();
      const isUsed = question.length > 0 || answer.length > 0;

      if (!isUsed) {
        continue;
      }

      if (!question) {
        return "Every prompt with an answer needs a question.";
      }

      if (question.length > 160) {
        return "Prompt questions must be 160 characters or fewer.";
      }

      if (answer.length > 500) {
        return "Prompt answers must be 500 characters or fewer.";
      }
    }

    return null;
  }

  async function handleSave() {
    const accessToken = session?.access_token;

    if (!profile || !accessToken || isSaving) {
      return;
    }

    const validationMessage = validate();

    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    const promptPayload = prompts
      .map((prompt) => ({
        id: prompt.id,
        question: prompt.question.trim(),
        answer: prompt.answer.trim(),
      }))
      .filter(
        (prompt) => prompt.question.length > 0 || prompt.answer.length > 0,
      );

    const body: ProfileUpdateRequest = {
      neighborhood: nullableText(neighborhood),
      relationship_intent: nullableText(relationshipIntent),
      seeking: nullableText(seeking),
      dating_radius_miles: datingRadius.trim() ? Number(datingRadius) : null,
      kids_status: nullableText(kidsStatus),
      kids_preference: nullableText(kidsPreference),
      prompts: promptPayload,
    };

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const response = await apiPatch<
        ProfileUpdateEnvelope,
        ProfileUpdateRequest
      >(
        "/members/me/profile",
        accessToken,
        body,
        `profile-update-${profile.id}-${profile.version}-${Date.now()}`,
        {
          "If-Match": String(profile.version),
        },
      );

      populateForm(response.data);
      router.back();
    } catch (error) {
      if (error instanceof ApiError && error.code === "version_conflict") {
        setErrorMessage(
          "Your profile changed while you were editing. The latest information has been reloaded.",
        );
        await loadProfile();
      } else {
        setErrorMessage(
          error instanceof ApiError
            ? error.message
            : "We could not save your profile.",
        );
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AppScreen includeBottomInset>
      <StackHeader title="Edit profile" />

      {isLoading && !profile ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#352D28" />
          <Text style={styles.loadingText}>Loading profile…</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.eyebrow}>MEMBER PROFILE</Text>
            <Text style={styles.title}>Edit your profile</Text>
            <Text style={styles.subtitle}>
              Keep these details current so introductions reflect who you are
              and what you are looking for.
            </Text>

            {errorMessage ? (
              <InlineNotice message={errorMessage} tone="danger" />
            ) : null}

            <Pressable
              accessibilityHint="Opens the private profile photo manager"
              accessibilityRole="button"
              onPress={() => router.push("/profile-photos")}
              style={({ pressed }) => [
                styles.photoCallout,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.photoCalloutIcon}>
                <Ionicons
                  color={palette.brand}
                  name="camera-outline"
                  size={23}
                />
              </View>
              <View style={styles.photoCalloutCopy}>
                <Text style={styles.photoCalloutTitle}>Profile photos</Text>
                <Text style={styles.photoCalloutBody}>
                  Add or replace your primary photo and see its private review
                  status.
                </Text>
              </View>
              <Ionicons
                color={palette.brand}
                name="chevron-forward"
                size={19}
              />
            </Pressable>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Dating preferences</Text>
              <Text style={styles.sectionDescription}>
                Guided choices make your intent clearer while still leaving
                room for your own words.
              </Text>

              <FormField
                label="Neighborhood"
                value={neighborhood}
                onChangeText={setNeighborhood}
                placeholder="Brickell"
                maxLength={120}
              />

              <ChoiceField
                customPlaceholder="Describe what you are looking for"
                label="Relationship goal"
                value={relationshipIntent}
                onChange={setRelationshipIntent}
                options={RELATIONSHIP_INTENTS}
              />

              <ChoiceField
                customPlaceholder="Describe who you would like to meet"
                label="Interested in"
                onChange={setSeeking}
                options={SEEKING_OPTIONS}
                value={seeking}
              />

              <ChoiceField
                customKeyboardType="number-pad"
                customMaxLength={3}
                customPlaceholder="Miles from 1 to 100"
                label="Dating radius"
                onChange={setDatingRadius}
                options={RADIUS_OPTIONS}
                value={datingRadius}
              />

              <ChoiceField
                customPlaceholder="Share what feels right for you"
                label="Do you have children?"
                onChange={setKidsStatus}
                options={KIDS_STATUS_OPTIONS}
                value={kidsStatus}
              />

              <ChoiceField
                customPlaceholder="Describe your family plans"
                label="Family plans"
                onChange={setKidsPreference}
                options={KIDS_PREFERENCE_OPTIONS}
                value={kidsPreference}
                isLast
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Profile prompts</Text>
              <Text style={styles.sectionDescription}>
                Add up to three prompts. Empty prompts will not be included on
                your profile.
              </Text>

              {prompts.map((prompt, index) => (
                <View key={prompt.id} style={styles.promptCard}>
                  <View style={styles.promptHeader}>
                    <Text style={styles.promptNumber}>
                      Prompt {index + 1}
                    </Text>
                    <Text style={styles.promptStatus}>
                      {prompt.question.trim() && prompt.answer.trim()
                        ? "Ready"
                        : "Incomplete"}
                    </Text>
                  </View>

                  <Text style={styles.promptGuideLabel}>
                    Choose a conversation-worthy prompt
                  </Text>
                  <ScrollView
                    contentContainerStyle={styles.promptSuggestions}
                    horizontal
                    keyboardShouldPersistTaps="handled"
                    showsHorizontalScrollIndicator={false}
                  >
                    {PROMPT_LIBRARY.map((question) => {
                      const selected = prompt.question === question;

                      return (
                        <Pressable
                          accessibilityRole="button"
                          key={question}
                          onPress={() =>
                            updatePrompt(index, "question", question)
                          }
                          style={[
                            styles.promptSuggestion,
                            selected && styles.promptSuggestionSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.promptSuggestionText,
                              selected &&
                                styles.promptSuggestionTextSelected,
                            ]}
                          >
                            {question}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  <TextInput
                    maxLength={160}
                    onChangeText={(value) =>
                      updatePrompt(index, "question", value)
                    }
                    placeholder="A question that says something about you"
                    placeholderTextColor={palette.subtle}
                    style={[styles.input, styles.customPromptInput]}
                    value={prompt.question}
                  />

                  <TextInput
                    maxLength={500}
                    multiline
                    onChangeText={(value) =>
                      updatePrompt(index, "answer", value)
                    }
                    placeholder="Share a specific detail, story, or opinion"
                    placeholderTextColor={palette.subtle}
                    style={[styles.input, styles.answerInput]}
                    textAlignVertical="top"
                    value={prompt.answer}
                  />

                  <View style={styles.answerFooter}>
                    <View style={styles.answerCoach}>
                      <Ionicons
                        color={
                          prompt.answer.trim().length >= 40
                            ? palette.sage
                            : palette.amber
                        }
                        name={
                          prompt.answer.trim().length >= 40
                            ? "checkmark-circle-outline"
                            : "sparkles-outline"
                        }
                        size={15}
                      />
                      <Text style={styles.answerCoachText}>
                        {prompt.answer.trim().length >= 40
                          ? "Specific enough to start a conversation"
                          : "Aim for 2–4 vivid, specific sentences"}
                      </Text>
                    </View>
                    <Text style={styles.characterCount}>
                      {prompt.answer.length}/500
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={() => void handleSave()}
              style={({ pressed }) => [
                styles.saveButton,
                pressed && styles.pressed,
                isSaving && styles.disabled,
              ]}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Save profile</Text>
              )}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.cancelButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </AppScreen>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  maxLength,
  isLast = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "number-pad";
  maxLength: number;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.field, isLast && styles.fieldLast]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        keyboardType={keyboardType}
        maxLength={maxLength}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#A49B93"
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function ChoiceField({
  label,
  value,
  onChange,
  options,
  customPlaceholder,
  customKeyboardType = "default",
  customMaxLength = 120,
  isLast = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ChoiceOption[];
  customPlaceholder: string;
  customKeyboardType?: "default" | "number-pad";
  customMaxLength?: number;
  isLast?: boolean;
}) {
  const matchesOption = options.some((option) => option.value === value);
  const [customMode, setCustomMode] = useState(
    Boolean(value && !matchesOption),
  );
  const showCustom = customMode || Boolean(value && !matchesOption);

  function chooseOption(option: ChoiceOption) {
    setCustomMode(false);
    onChange(option.value);
  }

  function chooseCustom() {
    setCustomMode(true);
    if (matchesOption) {
      onChange("");
    }
  }

  return (
    <View style={[styles.choiceField, isLast && styles.fieldLast]}>
      <View style={styles.choiceLabelRow}>
        <Text style={styles.label}>{label}</Text>
        {value ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => {
              setCustomMode(false);
              onChange("");
            }}
          >
            <Text style={styles.clearChoice}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.choiceGrid}>
        {options.map((option) => {
          const selected = value === option.value && !showCustom;

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={option.value}
              onPress={() => chooseOption(option)}
              style={[
                styles.choiceChip,
                selected && styles.choiceChipSelected,
              ]}
            >
              {selected ? (
                <Ionicons
                  color={palette.white}
                  name="checkmark"
                  size={15}
                />
              ) : null}
              <Text
                style={[
                  styles.choiceChipText,
                  selected && styles.choiceChipTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: showCustom }}
          onPress={chooseCustom}
          style={[
            styles.choiceChip,
            showCustom && styles.choiceChipSelected,
          ]}
        >
          <Ionicons
            color={showCustom ? palette.white : palette.brand}
            name="create-outline"
            size={15}
          />
          <Text
            style={[
              styles.choiceChipText,
              showCustom && styles.choiceChipTextSelected,
            ]}
          >
            My own words
          </Text>
        </Pressable>
      </View>

      {showCustom ? (
        <TextInput
          autoFocus={!value}
          keyboardType={customKeyboardType}
          maxLength={customMaxLength}
          onChangeText={onChange}
          placeholder={customPlaceholder}
          placeholderTextColor={palette.subtle}
          style={[styles.input, styles.customChoiceInput]}
          value={matchesOption ? "" : value}
        />
      ) : null}
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
  centered: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  loadingText: {
    color: "#746D66",
    fontSize: 15,
    marginTop: 14,
  },
  content: {
    alignSelf: "center",
    maxWidth: layout.contentMaxWidth,
    paddingBottom: 52,
    paddingHorizontal: 22,
    paddingTop: 24,
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
    fontSize: 30,
    fontWeight: "700",
    marginTop: 7,
  },
  subtitle: {
    color: "#746D66",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  photoCallout: {
    alignItems: "center",
    backgroundColor: palette.brandSoft,
    borderColor: palette.brandSoftStrong,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: space.sm,
    marginTop: space.xl,
    padding: space.md,
  },
  photoCalloutIcon: {
    alignItems: "center",
    backgroundColor: palette.surface,
    borderRadius: radius.sm,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  photoCalloutCopy: {
    flex: 1,
  },
  photoCalloutTitle: {
    color: palette.ink,
    ...typography.bodyStrong,
  },
  photoCalloutBody: {
    color: palette.muted,
    marginTop: 2,
    ...typography.small,
  },
  errorCard: {
    backgroundColor: "#F8E1DE",
    borderColor: "#E1BDB7",
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 20,
    padding: 14,
  },
  errorText: {
    color: "#7A3730",
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E3DDD6",
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 24,
    padding: 18,
  },
  sectionTitle: {
    color: "#292421",
    fontSize: 17,
    fontWeight: "700",
  },
  sectionDescription: {
    color: "#7A726B",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  field: {
    borderBottomColor: "#ECE7E2",
    borderBottomWidth: 1,
    paddingVertical: 14,
  },
  fieldLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  choiceField: {
    borderBottomColor: palette.border,
    borderBottomWidth: 1,
    paddingVertical: space.md,
  },
  choiceLabelRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  clearChoice: {
    color: palette.brand,
    ...typography.caption,
  },
  choiceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.xs,
    marginTop: space.sm,
  },
  choiceChip: {
    alignItems: "center",
    backgroundColor: palette.canvas,
    borderColor: palette.borderStrong,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    minHeight: 42,
    paddingHorizontal: space.sm,
    paddingVertical: 8,
  },
  choiceChipSelected: {
    backgroundColor: palette.brand,
    borderColor: palette.brand,
  },
  choiceChipText: {
    color: palette.inkSoft,
    fontSize: 13,
    fontWeight: "700",
  },
  choiceChipTextSelected: {
    color: palette.white,
  },
  customChoiceInput: {
    marginTop: space.sm,
  },
  label: {
    color: "#746D66",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 7,
  },
  input: {
    backgroundColor: "#F8F6F3",
    borderColor: "#DED7D0",
    borderRadius: 8,
    borderWidth: 1,
    color: "#292421",
    fontSize: 15,
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  promptCard: {
    borderTopColor: "#ECE7E2",
    borderTopWidth: 1,
    marginTop: 18,
    paddingTop: 18,
  },
  promptNumber: {
    color: "#746D66",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 9,
    textTransform: "uppercase",
  },
  promptHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  promptStatus: {
    color: palette.brand,
    ...typography.caption,
  },
  promptGuideLabel: {
    color: palette.inkSoft,
    fontSize: 13,
    fontWeight: "700",
    marginTop: space.xs,
  },
  promptSuggestions: {
    gap: space.xs,
    paddingBottom: space.xxs,
    paddingTop: space.sm,
  },
  promptSuggestion: {
    backgroundColor: palette.canvas,
    borderColor: palette.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    maxWidth: 260,
    paddingHorizontal: space.sm,
    paddingVertical: 10,
  },
  promptSuggestionSelected: {
    backgroundColor: palette.brandSoft,
    borderColor: palette.brand,
  },
  promptSuggestionText: {
    color: palette.inkSoft,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  promptSuggestionTextSelected: {
    color: palette.brand,
  },
  customPromptInput: {
    marginTop: space.sm,
  },
  answerInput: {
    marginTop: 10,
    minHeight: 108,
  },
  characterCount: {
    color: "#918880",
    fontSize: 11,
    textAlign: "right",
  },
  answerFooter: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: space.sm,
    justifyContent: "space-between",
    marginTop: space.xs,
  },
  answerCoach: {
    alignItems: "flex-start",
    flexDirection: "row",
    flex: 1,
    gap: 5,
  },
  answerCoachText: {
    color: palette.muted,
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: "#352D28",
    borderRadius: 9,
    height: 54,
    justifyContent: "center",
    marginTop: 26,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  cancelButton: {
    alignItems: "center",
    borderColor: "#BEB6AE",
    borderRadius: 9,
    borderWidth: 1,
    height: 52,
    justifyContent: "center",
    marginTop: 12,
  },
  cancelButtonText: {
    color: "#352D28",
    fontSize: 15,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.6,
  },
});
