import { useCallback, useState } from "react";
import { Stack, useFocusEffect, useRouter } from "expo-router";
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
    setRelationshipIntent(member.relationship_intent ?? "");
    setSeeking(member.seeking ?? "");
    setDatingRadius(
      member.dating_radius_miles === null
        ? ""
        : String(member.dating_radius_miles),
    );
    setKidsStatus(member.kids_status ?? "");
    setKidsPreference(member.kids_preference ?? "");
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
    <SafeAreaView style={styles.screen}>
      <Stack.Screen
        options={{
          title: "Edit profile",
          headerBackTitle: "Profile",
        }}
      />

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
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Basics</Text>

              <FormField
                label="Neighborhood"
                value={neighborhood}
                onChangeText={setNeighborhood}
                placeholder="Brickell"
                maxLength={120}
              />

              <FormField
                label="Relationship intent"
                value={relationshipIntent}
                onChangeText={setRelationshipIntent}
                placeholder="Long-term relationship"
                maxLength={120}
              />

              <FormField
                label="Interested in"
                value={seeking}
                onChangeText={setSeeking}
                placeholder="Women"
                maxLength={120}
              />

              <FormField
                label="Dating radius in miles"
                value={datingRadius}
                onChangeText={setDatingRadius}
                placeholder="25"
                keyboardType="number-pad"
                maxLength={3}
              />

              <FormField
                label="Kids status"
                value={kidsStatus}
                onChangeText={setKidsStatus}
                placeholder="No children"
                maxLength={120}
              />

              <FormField
                label="Kids preference"
                value={kidsPreference}
                onChangeText={setKidsPreference}
                placeholder="Open to children"
                maxLength={120}
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
                  <Text style={styles.promptNumber}>Prompt {index + 1}</Text>

                  <TextInput
                    maxLength={160}
                    onChangeText={(value) =>
                      updatePrompt(index, "question", value)
                    }
                    placeholder="A question that says something about you"
                    placeholderTextColor="#A49B93"
                    style={styles.input}
                    value={prompt.question}
                  />

                  <TextInput
                    maxLength={500}
                    multiline
                    onChangeText={(value) =>
                      updatePrompt(index, "answer", value)
                    }
                    placeholder="Your answer"
                    placeholderTextColor="#A49B93"
                    style={[styles.input, styles.answerInput]}
                    textAlignVertical="top"
                    value={prompt.answer}
                  />

                  <Text style={styles.characterCount}>
                    {prompt.answer.length}/500
                  </Text>
                </View>
              ))}
            </View>

            <Pressable
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
    </SafeAreaView>
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
    paddingBottom: 52,
    paddingHorizontal: 22,
    paddingTop: 24,
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
  answerInput: {
    marginTop: 10,
    minHeight: 108,
  },
  characterCount: {
    color: "#918880",
    fontSize: 11,
    marginTop: 6,
    textAlign: "right",
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
