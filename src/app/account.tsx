import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { type Href, router } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
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

type PreferenceMetadata = {
  email?: boolean;
  in_app?: boolean;
  push?: boolean;
};

const supportEmail = process.env.EXPO_PUBLIC_SUPPORT_EMAIL || "support@vouchdating.com";

export default function AccountScreen() {
  const {
    session,
    signOut,
    updateCommunicationPreferences,
    updatePassword,
  } = useAuth();
  const savedPreferences = useMemo(() => {
    const raw = session?.user.user_metadata?.vouch_communication_preferences;
    return raw && typeof raw === "object" ? (raw as PreferenceMetadata) : {};
  }, [session?.user.user_metadata]);
  const [emailUpdates, setEmailUpdates] = useState(savedPreferences.email ?? true);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [preferenceMessage, setPreferenceMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function savePassword() {
    if (newPassword.length < 8) {
      setErrorMessage("Choose a password with at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("The passwords do not match.");
      return;
    }

    setIsSavingPassword(true);
    setErrorMessage("");
    setPasswordMessage("");
    try {
      await updatePassword(newPassword);
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Your password is updated.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "We could not update your password.",
      );
    } finally {
      setIsSavingPassword(false);
    }
  }

  async function savePreferences(nextEmailValue: boolean) {
    setEmailUpdates(nextEmailValue);
    setIsSavingPreferences(true);
    setErrorMessage("");
    setPreferenceMessage("");
    try {
      await updateCommunicationPreferences({
        email: nextEmailValue,
        inApp: true,
        push: savedPreferences.push ?? false,
      });
      setPreferenceMessage("Communication preference saved.");
    } catch (error) {
      setEmailUpdates(!nextEmailValue);
      setErrorMessage(
        error instanceof Error ? error.message : "We could not save that preference.",
      );
    } finally {
      setIsSavingPreferences(false);
    }
  }

  async function openSupport(subject: string, body: string) {
    const url = `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Contact Vouch", `Email us at ${supportEmail}.`);
    }
  }

  function requestDeletion() {
    Alert.alert(
      "Request account deletion?",
      "Vouch will verify your request, explain any safety or legal retention requirement, and remove eligible data. Your account is not deleted just by opening the request.",
      [
        { text: "Keep account", style: "cancel" },
        {
          text: "Contact privacy team",
          style: "destructive",
          onPress: () =>
            void openSupport(
              "Vouch account deletion request",
              `Please begin a verified account deletion request for ${session?.user.email ?? "my Vouch account"}.`,
            ),
        },
      ],
    );
  }

  return (
    <AppScreen includeBottomInset>
      <StackHeader title="Account & settings" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.eyebrow}>YOUR PRIVATE ACCOUNT</Text>
          <Text accessibilityRole="header" style={styles.title}>Security, privacy, and support</Text>
          <Text style={styles.subtitle}>
            Control how you hear from Vouch and understand how your information is used.
          </Text>

          {errorMessage ? <InlineNotice message={errorMessage} tone="danger" /> : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.card}>
              <SettingRow icon="mail-outline" label="Email" value={session?.user.email ?? "Not available"} />
              <View style={styles.divider} />
              <Text style={styles.fieldLabel}>New password</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="new-password"
                onChangeText={setNewPassword}
                placeholder="At least 8 characters"
                placeholderTextColor={palette.subtle}
                secureTextEntry
                style={styles.input}
                value={newPassword}
              />
              <Text style={styles.fieldLabel}>Confirm new password</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="new-password"
                onChangeText={setConfirmPassword}
                placeholder="Repeat your password"
                placeholderTextColor={palette.subtle}
                secureTextEntry
                style={styles.input}
                value={confirmPassword}
              />
              {passwordMessage ? <InlineNotice message={passwordMessage} tone="positive" /> : null}
              <AppButton
                disabled={!newPassword || !confirmPassword}
                label="Update password"
                loading={isSavingPassword}
                onPress={() => void savePassword()}
                variant="secondary"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Communication</Text>
            <View style={styles.card}>
              <View style={styles.switchRow}>
                <View style={styles.settingIcon}>
                  <Ionicons color={palette.brand} name="notifications-outline" size={21} />
                </View>
                <View style={styles.switchCopy}>
                  <Text style={styles.rowTitle}>Essential in-app updates</Text>
                  <Text style={styles.rowBody}>
                    Introductions, messages, date changes, debriefs, and safety updates.
                  </Text>
                </View>
                <Switch disabled value trackColor={{ true: palette.sageSoft }} thumbColor={palette.sage} />
              </View>
              <View style={styles.divider} />
              <View style={styles.switchRow}>
                <View style={styles.settingIcon}>
                  <Ionicons color={palette.brand} name="newspaper-outline" size={21} />
                </View>
                <View style={styles.switchCopy}>
                  <Text style={styles.rowTitle}>Occasional email updates</Text>
                  <Text style={styles.rowBody}>
                    Product news and membership guidance. Essential account email is unaffected.
                  </Text>
                </View>
                <Switch
                  disabled={isSavingPreferences}
                  onValueChange={(value) => void savePreferences(value)}
                  value={emailUpdates}
                  trackColor={{ false: palette.canvasStrong, true: palette.sageSoft }}
                  thumbColor={emailUpdates ? palette.sage : palette.subtle}
                />
              </View>
              {preferenceMessage ? <Text style={styles.savedText}>{preferenceMessage}</Text> : null}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trust & help</Text>
            <View style={styles.linkCard}>
              <LinkRow icon="shield-checkmark-outline" label="Privacy & trust center" onPress={() => router.push("/trust-center" as Href)} />
              <LinkRow icon="sparkles-outline" label="AI matchmaking controls" onPress={() => router.push("/ai-matchmaker")} />
              <LinkRow icon="alert-circle-outline" label="Your safety reports" onPress={() => router.push("/safety-cases")} />
              <LinkRow icon="help-buoy-outline" label="Contact Vouch support" onPress={() => void openSupport("Vouch member support", "How can the Vouch team help?")} isLast />
            </View>
          </View>

          <View style={styles.dangerCard}>
            <Text style={styles.dangerTitle}>Data and account requests</Text>
            <Text style={styles.dangerBody}>
              Ask for a copy of your information or begin a verified deletion request with the privacy team.
            </Text>
            <Pressable onPress={() => void openSupport("Vouch data access request", "Please begin a verified request for a copy of my Vouch account information.")} style={styles.outlineButton}>
              <Text style={styles.outlineButtonText}>Request my data</Text>
            </Pressable>
            <Pressable onPress={requestDeletion} style={styles.deleteButton}>
              <Text style={styles.deleteButtonText}>Request account deletion</Text>
            </Pressable>
          </View>

          <AppButton label="Sign out" onPress={() => void signOut()} variant="secondary" />
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

function SettingRow({ icon, label, value }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; value: string }) {
  return <View style={styles.settingRow}><View style={styles.settingIcon}><Ionicons color={palette.brand} name={icon} size={21} /></View><View style={styles.switchCopy}><Text style={styles.rowTitle}>{label}</Text><Text style={styles.rowBody}>{value}</Text></View></View>;
}

function LinkRow({ icon, isLast = false, label, onPress }: { icon: React.ComponentProps<typeof Ionicons>["name"]; isLast?: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.linkRow, isLast && styles.linkRowLast, pressed && styles.pressed]}><View style={styles.settingIcon}><Ionicons color={palette.brand} name={icon} size={21} /></View><Text style={styles.linkLabel}>{label}</Text><Ionicons color={palette.subtle} name="chevron-forward" size={18} /></Pressable>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { alignSelf: "center", maxWidth: layout.contentMaxWidth, paddingBottom: space.xxxl, paddingHorizontal: space.lg, paddingTop: space.xl, width: "100%" },
  eyebrow: { color: palette.brand, ...typography.label }, title: { color: palette.ink, marginTop: space.xs, ...typography.title }, subtitle: { color: palette.muted, marginBottom: space.xl, marginTop: space.sm, ...typography.body },
  section: { marginBottom: space.xl }, sectionTitle: { color: palette.ink, marginBottom: space.sm, ...typography.heading },
  card: { backgroundColor: palette.surface, borderColor: palette.border, borderRadius: radius.md, borderWidth: 1, gap: space.sm, padding: space.md },
  settingRow: { alignItems: "center", flexDirection: "row", gap: space.sm }, settingIcon: { alignItems: "center", backgroundColor: palette.brandSoft, borderRadius: radius.sm, height: 42, justifyContent: "center", width: 42 }, switchCopy: { flex: 1 }, rowTitle: { color: palette.ink, ...typography.bodyStrong }, rowBody: { color: palette.muted, marginTop: 2, ...typography.small },
  divider: { backgroundColor: palette.border, height: StyleSheet.hairlineWidth, marginVertical: space.xs }, fieldLabel: { color: palette.inkSoft, ...typography.caption }, input: { backgroundColor: palette.canvas, borderColor: palette.border, borderRadius: radius.sm, borderWidth: 1, color: palette.ink, fontSize: 16, minHeight: 52, paddingHorizontal: space.md },
  switchRow: { alignItems: "center", flexDirection: "row", gap: space.sm }, savedText: { color: palette.sage, marginTop: space.xs, ...typography.caption },
  linkCard: { backgroundColor: palette.surface, borderColor: palette.border, borderRadius: radius.md, borderWidth: 1, overflow: "hidden" }, linkRow: { alignItems: "center", borderBottomColor: palette.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: space.sm, minHeight: 68, paddingHorizontal: space.md }, linkRowLast: { borderBottomWidth: 0 }, linkLabel: { color: palette.ink, flex: 1, ...typography.bodyStrong },
  dangerCard: { backgroundColor: palette.dangerSoft, borderColor: "#E9C9C2", borderRadius: radius.md, borderWidth: 1, marginBottom: space.xl, padding: space.md }, dangerTitle: { color: palette.ink, ...typography.heading }, dangerBody: { color: palette.inkSoft, marginTop: space.xs, ...typography.small }, outlineButton: { alignItems: "center", backgroundColor: palette.surface, borderColor: palette.border, borderRadius: radius.sm, borderWidth: 1, justifyContent: "center", marginTop: space.md, minHeight: 48 }, outlineButtonText: { color: palette.ink, ...typography.bodyStrong }, deleteButton: { alignItems: "center", justifyContent: "center", marginTop: space.xs, minHeight: 48 }, deleteButtonText: { color: palette.danger, ...typography.bodyStrong }, pressed: { opacity: 0.72 },
});
