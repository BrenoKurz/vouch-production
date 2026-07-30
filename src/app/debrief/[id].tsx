import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import {
  type Href,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  type ReactNode,
  useCallback,
  useMemo,
  useState,
} from 'react';

import {
  AppScreen,
  ErrorState,
  LoadingState,
  StackHeader,
} from '@/components/vouch-ui';
import {
  layout,
  palette,
  radius,
  space,
} from '@/constants/design';
import { ApiError, apiGet, apiPost } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import type {
  Debrief,
  DebriefEnvelope,
  DebriefReasonTag,
  DebriefSubmission,
} from '@/types/debrief';

const reasonOptions: {
  value: DebriefReasonTag;
  label: string;
}[] = [
  { value: 'chemistry_not_there', label: 'The chemistry was not there' },
  { value: 'different_values', label: 'Different values or priorities' },
  { value: 'timing_or_lifestyle', label: 'Timing or lifestyle mismatch' },
  { value: 'communication', label: 'Communication did not feel right' },
  { value: 'other', label: 'Something else' },
];

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export default function DebriefScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { session, signOut } = useAuth();
  const accessToken = session?.access_token;

  const [item, setItem] = useState<Debrief | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [dateHappened, setDateHappened] = useState<boolean | null>(null);
  const [seeAgain, setSeeAgain] = useState<boolean | null>(null);
  const [reasonTag, setReasonTag] = useState<DebriefReasonTag | null>(null);
  const [privateNote, setPrivateNote] = useState('');

  const canSubmit = useMemo(() => {
    if (dateHappened === null) return false;
    if (dateHappened && seeAgain === null) return false;
    return true;
  }, [dateHappened, seeAgain]);

  const load = useCallback(async () => {
    if (!id || !accessToken) {
      setErrorMessage('This private debrief could not be opened.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await apiGet<DebriefEnvelope>(
        `/debriefs/${encodeURIComponent(id)}`,
        accessToken,
      );

      setItem(response.data);
      setDateHappened(response.data.date_happened);
      setSeeAgain(response.data.see_again);
      setReasonTag(response.data.reason_tag);
      setPrivateNote(response.data.private_note ?? '');
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.status === 401 ||
          error.code === 'authentication_required')
      ) {
        await signOut();
        return;
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load this private debrief.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, id, signOut]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function chooseDateHappened(value: boolean) {
    setDateHappened(value);
    setErrorMessage('');

    if (!value) {
      setSeeAgain(null);
      if (reasonTag !== 'safety_concern') {
        setReasonTag('date_did_not_happen');
      }
      return;
    }

    if (reasonTag === 'date_did_not_happen') {
      setReasonTag(null);
    }
  }

  function chooseSeeAgain(value: boolean) {
    setSeeAgain(value);
    setErrorMessage('');

    if (value && reasonTag !== 'safety_concern') {
      setReasonTag(null);
    }
  }

  function selectSafetyConcern() {
    Alert.alert(
      'Private safety concern',
      'This response will be treated as a private safety report and may be reviewed by the Vouch team.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            setReasonTag('safety_concern');
            if (dateHappened === true) setSeeAgain(false);
          },
        },
      ],
    );
  }

  async function submit() {
    if (
      !item ||
      !accessToken ||
      isSubmitting ||
      !canSubmit ||
      dateHappened === null
    ) {
      setErrorMessage('Please answer the required questions.');
      return;
    }

    const finalReason: DebriefReasonTag | null =
      reasonTag === 'safety_concern'
        ? 'safety_concern'
        : !dateHappened
          ? 'date_did_not_happen'
          : seeAgain
            ? null
            : reasonTag;

    const body: DebriefSubmission = {
      date_happened: dateHappened,
      see_again: dateHappened ? seeAgain : null,
      reason_tag: finalReason,
      private_note: privateNote.trim() || null,
    };

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const response = await apiPost<
        DebriefEnvelope,
        DebriefSubmission
      >(
        `/debriefs/${encodeURIComponent(item.id)}`,
        accessToken,
        body,
        Crypto.randomUUID(),
      );

      setItem(response.data);

      Alert.alert(
        'Thank you',
        finalReason === 'safety_concern'
          ? 'Your private concern was submitted to Vouch.'
          : 'Your feedback was submitted privately.',
        [
          {
            text: 'Done',
            onPress: () =>
              router.replace(
                {
                  pathname: '/date/[id]',
                  params: { id: response.data.date_id },
                } as Href,
              ),
          },
        ],
      );
    } catch (error) {
      if (error instanceof ApiError) {
        if (
          error.status === 401 ||
          error.code === 'authentication_required'
        ) {
          await signOut();
          return;
        }

        if (
          error.code === 'state_conflict' ||
          error.code === 'debrief_already_submitted'
        ) {
          await load();
          setErrorMessage(
            'This debrief was already updated. We refreshed it.',
          );
          return;
        }

        setErrorMessage(error.message);
      } else {
        setErrorMessage('Unable to submit your private debrief.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <AppScreen includeBottomInset>
        <Header />
        <LoadingState label="Opening your private check-in…" />
      </AppScreen>
    );
  }

  if (!item) {
    return (
      <AppScreen includeBottomInset>
        <Header />
        <ErrorState
          body={errorMessage}
          onRetry={() => void load()}
          title="This debrief could not be opened"
        />
      </AppScreen>
    );
  }

  const profile = item.counterpart_profile;
  const photo = profile.photos[0]?.url;
  const submitted = item.state === 'submitted';

  if (submitted) {
    return (
      <AppScreen includeBottomInset>
        <Header />
        <View style={styles.center}>
          <View style={styles.successIcon}>
            <Ionicons
              color={palette.sage}
              name="checkmark"
              size={34}
            />
          </View>
          <Text style={styles.successTitle}>
            Your feedback is recorded.
          </Text>
          <Text style={styles.successBody}>
            Your answers remain private and are never shown to {profile.first_name}.
          </Text>
          <Pressable
            onPress={() =>
              router.replace(
                {
                  pathname: '/date/[id]',
                  params: { id: item.date_id },
                } as Href,
              )
            }
            style={styles.primaryButton}
          >
            <Text style={styles.primaryText}>Return to date</Text>
          </Pressable>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen includeBottomInset>
      <Header />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.personRow}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.initial}>
                  {profile.first_name.slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}

            <View style={styles.personCopy}>
              <Text style={styles.eyebrow}>PRIVATE DEBRIEF</Text>
              <Text style={styles.title}>
                How did it go with {profile.first_name}?
              </Text>
              <Text style={styles.dateText}>
                {formatDateTime(item.date.starts_at)}
              </Text>
            </View>
          </View>

          <View style={styles.privacyCard}>
            <Ionicons
              color={palette.sage}
              name="lock-closed-outline"
              size={20}
            />
            <Text style={styles.privacyText}>
              Your answers are private. {profile.first_name} will not see them.
            </Text>
          </View>

          <QuestionCard title="Did the date happen?">
            <ChoiceRow
              firstLabel="Yes"
              firstSelected={dateHappened === true}
              onFirst={() => chooseDateHappened(true)}
              secondLabel="No"
              secondSelected={dateHappened === false}
              onSecond={() => chooseDateHappened(false)}
            />
          </QuestionCard>

          {dateHappened === true ? (
            <QuestionCard title="Would you like to see them again?">
              <ChoiceRow
                firstLabel="Yes"
                firstSelected={seeAgain === true}
                onFirst={() => chooseSeeAgain(true)}
                secondLabel="No"
                secondSelected={seeAgain === false}
                onSecond={() => chooseSeeAgain(false)}
              />
            </QuestionCard>
          ) : null}

          {dateHappened === true && seeAgain === false ? (
            <QuestionCard
              optional
              title="What was the main reason?"
            >
              <View style={styles.reasonList}>
                {reasonOptions.map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() => setReasonTag(option.value)}
                    style={[
                      styles.reasonButton,
                      reasonTag === option.value &&
                        styles.reasonButtonSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.reasonText,
                        reasonTag === option.value &&
                          styles.reasonTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {reasonTag === option.value ? (
                      <Ionicons
                        color="#FFFFFF"
                        name="checkmark"
                        size={18}
                      />
                    ) : null}
                  </Pressable>
                ))}
              </View>
            </QuestionCard>
          ) : null}

          {dateHappened !== null ? (
            <QuestionCard
              optional
              title="Anything else you want Vouch to know?"
            >
              <TextInput
                maxLength={2000}
                multiline
                onChangeText={setPrivateNote}
                placeholder="This note is private to Vouch."
                placeholderTextColor={palette.subtle}
                style={styles.noteInput}
                textAlignVertical="top"
                value={privateNote}
              />
              <Text style={styles.characterCount}>
                {privateNote.length}/2000
              </Text>
            </QuestionCard>
          ) : null}

          {dateHappened !== null ? (
            <Pressable
              onPress={selectSafetyConcern}
              style={[
                styles.safetyButton,
                reasonTag === 'safety_concern' &&
                  styles.safetyButtonSelected,
              ]}
            >
              <Ionicons
                color={
                  reasonTag === 'safety_concern'
                    ? '#FFFFFF'
                    : '#963E36'
                }
                name="shield-outline"
                size={20}
              />
              <Text
                style={[
                  styles.safetyText,
                  reasonTag === 'safety_concern' &&
                    styles.safetyTextSelected,
                ]}
              >
                {reasonTag === 'safety_concern'
                  ? 'Safety concern selected'
                  : 'Report a private safety concern'}
              </Text>
            </Pressable>
          ) : null}

          {errorMessage ? (
            <Text style={styles.inlineError}>{errorMessage}</Text>
          ) : null}

          <Pressable
            disabled={!canSubmit || isSubmitting}
            onPress={() => void submit()}
            style={[
              styles.primaryButton,
              (!canSubmit || isSubmitting) && styles.disabledButton,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryText}>
                Submit private debrief
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

function QuestionCard({
  title,
  optional = false,
  children,
}: {
  title: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={styles.questionCard}>
      <View style={styles.questionHeading}>
        <Text style={styles.questionTitle}>{title}</Text>
        {optional ? (
          <Text style={styles.optionalLabel}>OPTIONAL</Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function ChoiceRow({
  firstLabel,
  firstSelected,
  onFirst,
  secondLabel,
  secondSelected,
  onSecond,
}: {
  firstLabel: string;
  firstSelected: boolean;
  onFirst: () => void;
  secondLabel: string;
  secondSelected: boolean;
  onSecond: () => void;
}) {
  return (
    <View style={styles.choiceRow}>
      <Pressable
        onPress={onFirst}
        style={[
          styles.choiceButton,
          firstSelected && styles.choiceButtonSelected,
        ]}
      >
        <Text
          style={[
            styles.choiceText,
            firstSelected && styles.choiceTextSelected,
          ]}
        >
          {firstLabel}
        </Text>
      </Pressable>

      <Pressable
        onPress={onSecond}
        style={[
          styles.choiceButton,
          secondSelected && styles.choiceButtonSelected,
        ]}
      >
        <Text
          style={[
            styles.choiceText,
            secondSelected && styles.choiceTextSelected,
          ]}
        >
          {secondLabel}
        </Text>
      </Pressable>
    </View>
  );
}

function Header() {
  return <StackHeader />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    alignSelf: 'center',
    maxWidth: layout.contentMaxWidth,
    paddingBottom: space.xxxl,
    paddingHorizontal: space.lg,
    width: '100%',
  },
  personRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    marginTop: 12,
  },
  avatar: {
    backgroundColor: palette.canvasStrong,
    borderRadius: radius.sm,
    height: 92,
    width: 76,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: palette.brand,
    fontSize: 30,
    fontWeight: '600',
  },
  personCopy: { flex: 1 },
  eyebrow: {
    color: palette.brand,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  title: {
    color: palette.ink,
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 31,
    marginTop: 6,
  },
  dateText: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 5,
  },
  privacyCard: {
    alignItems: 'flex-start',
    backgroundColor: palette.sageSoft,
    borderRadius: radius.sm,
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
    padding: 15,
  },
  privacyText: {
    color: palette.sage,
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  questionCard: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: 16,
    padding: 17,
  },
  questionHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  questionTitle: {
    color: palette.ink,
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 23,
  },
  optionalLabel: {
    color: palette.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    marginLeft: 10,
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 15,
  },
  choiceButton: {
    alignItems: 'center',
    borderColor: palette.borderStrong,
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    height: 48,
    justifyContent: 'center',
  },
  choiceButtonSelected: {
    backgroundColor: palette.brand,
    borderColor: palette.brand,
  },
  choiceText: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  choiceTextSelected: { color: palette.white },
  reasonList: { gap: 9, marginTop: 15 },
  reasonButton: {
    alignItems: 'center',
    borderColor: palette.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  reasonButtonSelected: {
    backgroundColor: palette.brand,
    borderColor: palette.brand,
  },
  reasonText: {
    color: palette.inkSoft,
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
  },
  reasonTextSelected: { color: palette.white, fontWeight: '700' },
  noteInput: {
    backgroundColor: palette.canvas,
    borderColor: palette.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: palette.ink,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 15,
    minHeight: 112,
    padding: 13,
  },
  characterCount: {
    color: palette.muted,
    fontSize: 11,
    marginTop: 7,
    textAlign: 'right',
  },
  safetyButton: {
    alignItems: 'center',
    borderColor: palette.brandSoftStrong,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  safetyButtonSelected: {
    backgroundColor: palette.danger,
    borderColor: palette.danger,
  },
  safetyText: {
    color: palette.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  safetyTextSelected: { color: palette.white },
  inlineError: {
    backgroundColor: palette.dangerSoft,
    borderRadius: radius.sm,
    color: palette.danger,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 18,
    padding: 14,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: palette.brand,
    borderRadius: radius.sm,
    height: 56,
    justifyContent: 'center',
    marginTop: 20,
    paddingHorizontal: 18,
  },
  disabledButton: { opacity: 0.45 },
  primaryText: {
    color: palette.white,
    fontSize: 16,
    fontWeight: '800',
  },
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 28,
  },
  helper: {
    color: '#68635D',
    fontSize: 14,
    marginTop: 14,
  },
  errorTitle: {
    color: '#1F1D1B',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },
  errorBody: {
    color: '#6F6861',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 9,
    textAlign: 'center',
  },
  successIcon: {
    alignItems: 'center',
    backgroundColor: palette.sageSoft,
    borderRadius: 34,
    height: 68,
    justifyContent: 'center',
    width: 68,
  },
  successTitle: {
    color: palette.ink,
    fontSize: 25,
    fontWeight: '700',
    marginTop: 20,
    textAlign: 'center',
  },
  successBody: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
    maxWidth: 320,
    textAlign: 'center',
  },
});
