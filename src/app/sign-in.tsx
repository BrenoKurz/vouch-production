import { Ionicons } from "@expo/vector-icons";
import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Pressable,
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
  const { requestPasswordReset, signIn, signUp } = useAuth();
  const passwordRef = useRef<TextInput>(null);
  const [mode, setMode] = useState<"sign_in" | "sign_up">("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSignIn() {
    if (!email.trim() || !password) {
      setErrorMessage("Enter your email and password.");
      return;
    }

    if (mode === "sign_up" && password.length < 8) {
      setErrorMessage("Create a password with at least 8 characters.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      if (mode === "sign_in") {
        await signIn(email, password);
      } else {
        const result = await signUp(email, password);
        if (result.requiresEmailConfirmation) {
          setPassword("");
          setSuccessMessage(
            "Check your email to confirm your account, then return here to continue.",
          );
        }
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to sign in.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePasswordReset() {
    if (!email.trim()) {
      setErrorMessage("Enter your email first, then choose Forgot password.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await requestPasswordReset(email);
      setSuccessMessage(
        "If an account exists for that email, a private reset link is on its way.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We could not send a reset link.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function changeMode(nextMode: "sign_in" | "sign_up") {
    setMode(nextMode);
    setPassword("");
    setErrorMessage("");
    setSuccessMessage("");
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
            <View style={styles.modeTabs}>
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === "sign_in" }}
                onPress={() => changeMode("sign_in")}
                style={[
                  styles.modeTab,
                  mode === "sign_in" && styles.modeTabSelected,
                ]}
              >
                <Text
                  style={[
                    styles.modeTabText,
                    mode === "sign_in" && styles.modeTabTextSelected,
                  ]}
                >
                  Sign in
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === "sign_up" }}
                onPress={() => changeMode("sign_up")}
                style={[
                  styles.modeTab,
                  mode === "sign_up" && styles.modeTabSelected,
                ]}
              >
                <Text
                  style={[
                    styles.modeTabText,
                    mode === "sign_up" && styles.modeTabTextSelected,
                  ]}
                >
                  Apply
                </Text>
              </Pressable>
            </View>

            <Text style={styles.formTitle}>
              {mode === "sign_in" ? "Welcome back" : "Start privately"}
            </Text>
            <Text style={styles.formSubtitle}>
              {mode === "sign_in"
                ? "Sign in to your private member account."
                : "Create an account first. Every membership application is reviewed by Vouch."}
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
                onSubmitEditing={() => passwordRef.current?.focus()}
                returnKeyType="next"
                style={styles.input}
                value={email}
              />
            </View>

            <View style={styles.field}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Password</Text>
                {mode === "sign_in" ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={isSubmitting}
                    onPress={() => void handlePasswordReset()}
                  >
                    <Text style={styles.textAction}>Forgot password?</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.passwordHint}>8+ characters</Text>
                )}
              </View>
              <View style={styles.passwordControl}>
                <TextInput
                  accessibilityLabel="Password"
                  autoCapitalize="none"
                  autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
                  onChangeText={setPassword}
                  onSubmitEditing={() => void handleSignIn()}
                  placeholder={mode === "sign_in" ? "Your password" : "Create a password"}
                  placeholderTextColor={palette.subtle}
                  ref={passwordRef}
                  returnKeyType="go"
                  secureTextEntry={!showPassword}
                  style={styles.passwordInput}
                  value={password}
                />
                <Pressable
                  accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                  accessibilityRole="button"
                  hitSlop={10}
                  onPress={() => setShowPassword((current) => !current)}
                  style={styles.passwordToggle}
                >
                  <Ionicons
                    color={palette.muted}
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={21}
                  />
                </Pressable>
              </View>
            </View>

            {errorMessage ? (
              <InlineNotice message={errorMessage} tone="danger" />
            ) : null}
            {successMessage ? (
              <InlineNotice message={successMessage} tone="positive" />
            ) : null}

            <AppButton
              label={mode === "sign_in" ? "Sign in" : "Create account"}
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
  modeTabs: {
    backgroundColor: palette.canvasStrong,
    borderRadius: radius.sm,
    flexDirection: "row",
    padding: 4,
  },
  modeTab: {
    alignItems: "center",
    borderRadius: radius.xs,
    flex: 1,
    minHeight: 42,
    justifyContent: "center",
  },
  modeTabSelected: {
    backgroundColor: palette.surface,
  },
  modeTabText: {
    color: palette.muted,
    ...typography.caption,
  },
  modeTabTextSelected: {
    color: palette.ink,
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
  labelRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  textAction: {
    color: palette.brand,
    ...typography.caption,
  },
  passwordHint: {
    color: palette.muted,
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
  passwordControl: {
    alignItems: "center",
    backgroundColor: palette.canvas,
    borderColor: palette.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 54,
  },
  passwordInput: {
    color: palette.ink,
    flex: 1,
    fontSize: 16,
    minHeight: 52,
    paddingLeft: space.md,
  },
  passwordToggle: {
    alignItems: "center",
    height: 52,
    justifyContent: "center",
    width: 52,
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
