import * as Crypto from 'expo-crypto';
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
} from 'react-native';
import { useMemo, useState } from 'react';

import {
  AppScreen,
  InlineNotice,
  VouchWordmark,
} from '@/components/vouch-ui';
import { DateOfBirthField } from '@/components/date-of-birth-field';
import {
  layout,
  palette,
  radius,
  space,
  typography,
} from '@/constants/design';
import { ApiError, apiPost } from '@/lib/api';
import { isEligibleDateOfBirth } from '@/lib/date-of-birth';
import { useAuth } from '@/providers/auth-provider';
import { useMemberAccess } from '@/providers/member-access-provider';
import type {
  ApplicationRequest,
  ApplicationResponse,
} from '@/types/application';

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

    if (!isEligibleDateOfBirth(dateOfBirth)) {
      errors.date_of_birth = [
        'Choose a valid birthday showing you are at least 18.',
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

  function handleDateOfBirthChange(value: string) {
    setDateOfBirth(value);
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.date_of_birth;
      return next;
    });
  }

  return (
    <AppScreen includeBottomInset>
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
            <VouchWordmark />
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

            <DateOfBirthField
              disabled={isSubmitting}
              error={fieldErrors.date_of_birth?.[0]}
              onChange={handleDateOfBirthChange}
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
              <InlineNotice message={errorMessage} tone="danger" />
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
                <ActivityIndicator color={palette.white} />
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
    </AppScreen>
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
        placeholderTextColor={palette.subtle}
        style={[styles.input, error && styles.inputError]}
        {...inputProps}
      />

      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    alignSelf: 'center',
    maxWidth: Math.min(layout.contentMaxWidth, 600),
    paddingBottom: space.xxxl,
    paddingHorizontal: space.xl,
    paddingTop: space.xxl,
    width: '100%',
  },
  eyebrow: {
    color: palette.brand,
    marginTop: space.xxxl,
    ...typography.label,
  },
  title: {
    color: palette.ink,
    marginTop: space.sm,
    ...typography.display,
  },
  body: {
    color: palette.muted,
    marginTop: space.sm,
    ...typography.body,
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
    color: palette.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  optional: {
    color: palette.muted,
    fontSize: 12,
  },
  input: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: palette.ink,
    fontSize: 16,
    height: 54,
    paddingHorizontal: 16,
  },
  inputError: {
    borderColor: palette.danger,
  },
  readOnlyInput: {
    backgroundColor: palette.canvasStrong,
    borderColor: palette.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    minHeight: 54,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  readOnlyText: {
    color: palette.muted,
    fontSize: 16,
  },
  fieldError: {
    color: palette.danger,
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
    backgroundColor: palette.brand,
    borderRadius: radius.sm,
    height: 56,
    justifyContent: 'center',
    marginTop: 6,
  },
  primaryText: {
    color: palette.white,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: palette.borderStrong,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 54,
    justifyContent: 'center',
  },
  secondaryText: {
    color: palette.ink,
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
