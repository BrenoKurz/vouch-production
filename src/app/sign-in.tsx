import { Ionicons } from "@expo/vector-icons";
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
  VouchWordmark,
} from "@/components/vouch-ui";
import {
  layout,
  palette,
  radius,
  space,
  typography,
} from "@/constants/design";
import { useAuth } from "@/providers/auth-provider";

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSignIn() {
    if (!email.trim() || !password) {
      setErrorMessage("Enter your email and password.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await signIn(email, password);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to sign in.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppScreen includeBottomInset>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.intro}>
            <VouchWordmark />

            <View style={styles.heroMark}>
              <Ionicons
                color={palette.brand}
                name="heart-outline"
                size={28}
              />
            </View>

            <Text accessibilityRole="header" style={styles.title}>
              Dating, thoughtfully{" "}
              <Text style={styles.titleAccent}>introduced.</Text>
            </Text>
            <Text style={styles.subtitle}>
              A private membership for considered introductions and supported
              date experiences.
            </Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Welcome back</Text>
            <Text style={styles.formSubtitle}>
              Sign in to your private member account.
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                accessibilityLabel="Email"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={palette.subtle}
                returnKeyType="next"
                style={styles.input}
                value={email}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                accessibilityLabel="Password"
                autoCapitalize="none"
                autoComplete="password"
                onChangeText={setPassword}
                onSubmitEditing={() => void handleSignIn()}
                placeholder="Your password"
                placeholderTextColor={palette.subtle}
                returnKeyType="go"
                secureTextEntry
                style={styles.input}
                value={password}
              />
            </View>

            {errorMessage ? (
              <InlineNotice message={errorMessage} tone="danger" />
            ) : null}

            <AppButton
              label="Sign in"
              loading={isSubmitting}
              onPress={() => void handleSignIn()}
            />
          </View>

          <View style={styles.privacyRow}>
            <Ionicons
              color={palette.sage}
              name="lock-closed-outline"
              size={16}
            />
            <Text style={styles.footer}>
              Membership is private. Access is reviewed by Vouch.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    alignSelf: "center",
    flexGrow: 1,
    justifyContent: "center",
    maxWidth: Math.min(layout.contentMaxWidth, 560),
    paddingBottom: space.xxl,
    paddingHorizontal: space.xl,
    paddingTop: space.xxl,
    width: "100%",
  },
  intro: {
    paddingBottom: space.xxl,
  },
  heroMark: {
    alignItems: "center",
    backgroundColor: palette.brandSoft,
    borderRadius: radius.md,
    height: 54,
    justifyContent: "center",
    marginTop: space.xxxl,
    transform: [{ rotate: "-4deg" }],
    width: 54,
  },
  title: {
    color: palette.ink,
    marginTop: space.lg,
    maxWidth: 460,
    ...typography.display,
  },
  titleAccent: {
    color: palette.brand,
    fontFamily: "Georgia",
    fontStyle: "italic",
    fontWeight: "600",
  },
  subtitle: {
    color: palette.muted,
    marginTop: space.md,
    maxWidth: 460,
    ...typography.body,
  },
  formCard: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: space.lg,
    padding: space.xl,
  },
  formTitle: {
    color: palette.ink,
    ...typography.heading,
  },
  formSubtitle: {
    color: palette.muted,
    marginTop: -space.sm,
    ...typography.small,
  },
  field: {
    gap: space.xs,
  },
  label: {
    color: palette.ink,
    ...typography.caption,
  },
  input: {
    backgroundColor: palette.canvas,
    borderColor: palette.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: palette.ink,
    fontSize: 16,
    minHeight: 54,
    paddingHorizontal: space.md,
  },
  privacyRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.xs,
    justifyContent: "center",
    marginTop: space.xl,
  },
  footer: {
    color: palette.muted,
    ...typography.caption,
  },
});
