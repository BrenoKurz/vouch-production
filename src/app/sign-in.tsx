import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/providers/auth-provider';

const colors = {
  ink: '#171717',
  muted: '#68635D',
  border: '#DCD7D0',
  canvas: '#F7F4EF',
  surface: '#FFFFFF',
  accent: '#352D28',
  error: '#A33A32',
};

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSignIn() {
    if (!email.trim() || !password) {
      setErrorMessage('Enter your email and password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await signIn(email, password);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to sign in.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <View>
            <Text style={styles.wordmark}>VOUCH</Text>
            <Text style={styles.title}>Dating, thoughtfully introduced.</Text>
            <Text style={styles.subtitle}>
              Sign in to review your introductions, dates, and profile.
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#9C968F"
                returnKeyType="next"
                style={styles.input}
                value={email}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="password"
                onChangeText={setPassword}
                onSubmitEditing={handleSignIn}
                placeholder="Your password"
                placeholderTextColor="#9C968F"
                returnKeyType="go"
                secureTextEntry
                style={styles.input}
                value={password}
              />
            </View>

            {errorMessage ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {errorMessage}
              </Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={handleSignIn}
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                isSubmitting && styles.buttonDisabled,
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Sign in</Text>
              )}
            </Pressable>
          </View>

          <Text style={styles.footer}>
            Membership is private and access is reviewed by Vouch.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  keyboardView: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingBottom: 24,
    paddingTop: 56,
  },
  wordmark: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 4,
    marginBottom: 30,
  },
  title: {
    color: colors.ink,
    fontSize: 38,
    fontWeight: '600',
    letterSpacing: -1.2,
    lineHeight: 43,
    maxWidth: 330,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 16,
    maxWidth: 340,
  },
  form: { gap: 18 },
  field: { gap: 8 },
  label: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    height: 54,
    paddingHorizontal: 16,
  },
  error: { color: colors.error, fontSize: 14, lineHeight: 20 },
  button: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 10,
    height: 56,
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonPressed: { opacity: 0.9 },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  footer: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
