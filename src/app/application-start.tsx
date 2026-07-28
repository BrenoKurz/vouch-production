import * as Crypto from 'expo-crypto';
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
} from 'react-native';
import { useMemo, useState } from 'react';

import { ApiError, apiPost } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import { useMemberAccess } from '@/providers/member-access-provider';
import type {
  ApplicationRequest,
  ApplicationResponse,
} from '@/types/application';

function validDateOfBirth(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  const exact =
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;

  return exact && parsed.getTime() <= Date.now();
}

export default function ApplicationStartScreen() {
  const { session, signOut } = useAuth();
  const { refresh } = useMemberAccess();

  const initialFirstName = useMemo(() => {
    const metadata = session?.user.user_metadata;
    const direct = metadata?.first_name;

    if (typeof direct === 'string' && direct.trim()) {
      return direct.trim();
    }

    const displayName = metadata?.display_name;

    if (typeof displayName === 'string' && displayName.trim()) {
      return displayName.trim().split(/\s+/)[0] ?? '';
    }

    return '';
  }, [session?.user.user_metadata]);

  const email = session?.user.email ?? '';
  const [firstName, setFirstName] = useState(initialFirstName);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[]>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate() {
    const errors: Record<string, string[]> = {};

    if (!firstName.trim()) {
      errors.first_name = ['Enter your first name.'];
    }

    if (!validDateOfBirth(dateOfBirth.trim())) {
      errors.date_of_birth = [
        'Enter a valid date in YYYY-MM-DD format.',
      ];
    }

    if (!email) {
      errors.email = [
        'This account does not have an email address.',
      ];
    }

    if (!neighborhood.trim()) {
      errors.neighborhood = ['Enter your neighborhood.'];
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    if (!session?.access_token || !email) return;

    setIsSubmitting(true);
    setErrorMessage('');
    setFieldErrors({});

    const payload: ApplicationRequest = {
      first_name: firstName.trim(),
      date_of_birth: dateOfBirth.trim(),
      neighborhood: neighborhood.trim(),
      ...(referralCode.trim()
        ? { referral_code: referralCode.trim() }
        : {}),
    };

    try {
      await apiPost<ApplicationResponse, ApplicationRequest>(
        '/applications',
        session.access_token,
        payload,
        Crypto.randomUUID(),
      );

      await refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        if (
          error.status === 401 ||
          error.code === 'authentication_required'
        ) {
          await signOut();
          return;
        }

        if (error.code === 'state_conflict') {
          await refresh();
          return;
        }

        setFieldErrors(error.fieldErrors ?? {});
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Unable to submit your application.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View>
            <Text style={styles.wordmark}>VOUCH</Text>
            <Text style={styles.eyebrow}>MEMBERSHIP APPLICATION</Text>
            <Text style={styles.title}>Tell us a little about you.</Text>
            <Text style={styles.body}>
              Every application is reviewed thoughtfully by the Vouch
              team.
            </Text>
          </View>

          <View style={styles.form}>
            <Field
              autoCapitalize="words"
              error={fieldErrors.first_name?.[0]}
              label="First name"
              onChangeText={setFirstName}
              placeholder="Your first name"
              value={firstName}
            />

            <Field
              error={fieldErrors.date_of_birth?.[0]}
              keyboardType="numbers-and-punctuation"
              label="Date of birth"
              maxLength={10}
              onChangeText={setDateOfBirth}
              placeholder="YYYY-MM-DD"
              value={dateOfBirth}
            />

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.readOnlyInput}>
                <Text style={styles.readOnlyText}>{email}</Text>
              </View>
              {fieldErrors.email?.[0] ? (
                <Text style={styles.fieldError}>
                  {fieldErrors.email[0]}
                </Text>
              ) : null}
            </View>

            <Field
              autoCapitalize="words"
              error={fieldErrors.neighborhood?.[0]}
              label="Neighborhood"
              onChangeText={setNeighborhood}
              placeholder="For example: Brickell"
              value={neighborhood}
            />

            <Field
              autoCapitalize="characters"
              error={fieldErrors.referral_code?.[0]}
              label="Referral code"
              onChangeText={setReferralCode}
              optional
              placeholder="Optional"
              value={referralCode}
            />

            {errorMessage ? (
              <Text accessibilityRole="alert" style={styles.formError}>
                {errorMessage}
              </Text>
            ) : null}

            <Pressable
              disabled={isSubmitting}
              onPress={handleSubmit}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
                isSubmitting && styles.disabled,
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryText}>
                  Submit application
                </Text>
              )}
            </Pressable>

            <Pressable
              disabled={isSubmitting}
              onPress={signOut}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.secondaryText}>Sign out</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  optional = false,
  error,
  ...inputProps
}: React.ComponentProps<typeof TextInput> & {
  label: string;
  optional?: boolean;
  error?: string;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {optional ? (
          <Text style={styles.optional}>Optional</Text>
        ) : null}
      </View>

      <TextInput
        autoCorrect={false}
        placeholderTextColor="#9C968F"
        style={[styles.input, error && styles.inputError]}
        {...inputProps}
      />

      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7F4EF',
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingBottom: 36,
    paddingHorizontal: 26,
    paddingTop: 46,
  },
  wordmark: {
    color: '#352D28',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 4,
  },
  eyebrow: {
    color: '#776F68',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
    marginTop: 42,
  },
  title: {
    color: '#171717',
    fontSize: 36,
    fontWeight: '600',
    letterSpacing: -1,
    lineHeight: 42,
    marginTop: 12,
  },
  body: {
    color: '#68635D',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 14,
  },
  form: {
    gap: 19,
    marginTop: 34,
  },
  field: {
    gap: 8,
  },
  labelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    color: '#24211F',
    fontSize: 14,
    fontWeight: '700',
  },
  optional: {
    color: '#817A73',
    fontSize: 12,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DCD7D0',
    borderRadius: 10,
    borderWidth: 1,
    color: '#171717',
    fontSize: 16,
    height: 54,
    paddingHorizontal: 16,
  },
  inputError: {
    borderColor: '#A33A32',
  },
  readOnlyInput: {
    backgroundColor: '#EEEAE5',
    borderColor: '#DCD7D0',
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 54,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  readOnlyText: {
    color: '#6F6861',
    fontSize: 16,
  },
  fieldError: {
    color: '#A33A32',
    fontSize: 13,
    lineHeight: 18,
  },
  formError: {
    backgroundColor: '#F6E9E6',
    borderRadius: 8,
    color: '#943D35',
    fontSize: 14,
    lineHeight: 20,
    padding: 12,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#352D28',
    borderRadius: 10,
    height: 56,
    justifyContent: 'center',
    marginTop: 6,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#BEB6AE',
    borderRadius: 10,
    borderWidth: 1,
    height: 54,
    justifyContent: 'center',
  },
  secondaryText: {
    color: '#352D28',
    fontSize: 16,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.65,
  },
});
