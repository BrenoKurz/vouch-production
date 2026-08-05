import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  AppButton,
  AppScreen,
  InlineNotice,
  StackHeader,
} from "@/components/vouch-ui";
import { layout, palette, radius, space, typography } from "@/constants/design";
import { useAuth } from "@/providers/auth-provider";

export default function ResetPasswordScreen() {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function savePassword() {
    if (password.length < 8) {
      setErrorMessage("Choose a password with at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setErrorMessage("The passwords do not match.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    try {
      await updatePassword(password);
      router.replace("/");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "We could not update your password.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AppScreen includeBottomInset>
      <StackHeader title="Secure your account" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.icon}>
            <Ionicons color={palette.brand} name="key-outline" size={28} />
          </View>
          <Text accessibilityRole="header" style={styles.title}>Choose a new password</Text>
          <Text style={styles.body}>
            Use at least 8 characters and avoid a password you use elsewhere.
          </Text>

          <View style={styles.card}>
            <PasswordField label="New password" onChangeText={setPassword} value={password} />
            <PasswordField label="Confirm password" onChangeText={setConfirm} value={confirm} />
            {errorMessage ? <InlineNotice message={errorMessage} tone="danger" /> : null}
            <AppButton label="Save new password" loading={isSaving} onPress={() => void savePassword()} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

function PasswordField({ label, onChangeText, value }: { label: string; onChangeText: (value: string) => void; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCapitalize="none"
        autoComplete="new-password"
        onChangeText={onChangeText}
        placeholder="At least 8 characters"
        placeholderTextColor={palette.subtle}
        secureTextEntry
        style={styles.input}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { alignSelf: "center", maxWidth: Math.min(layout.contentMaxWidth, 560), padding: space.xl, width: "100%" },
  icon: { alignItems: "center", backgroundColor: palette.brandSoft, borderRadius: radius.md, height: 56, justifyContent: "center", width: 56 },
  title: { color: palette.ink, marginTop: space.lg, ...typography.title },
  body: { color: palette.muted, marginTop: space.sm, ...typography.body },
  card: { backgroundColor: palette.surface, borderColor: palette.border, borderRadius: radius.lg, borderWidth: 1, gap: space.lg, marginTop: space.xl, padding: space.xl },
  field: { gap: space.xs },
  label: { color: palette.ink, ...typography.caption },
  input: { backgroundColor: palette.canvas, borderColor: palette.border, borderRadius: radius.sm, borderWidth: 1, color: palette.ink, fontSize: 16, minHeight: 54, paddingHorizontal: space.md },
});
