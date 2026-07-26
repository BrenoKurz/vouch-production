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
  SafeAreaView,
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

import { ApiError, apiGet, apiPost } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import type {
  Debrief,
  DebriefEnvelope,
  DebriefReasonTag,
  DebriefSubmission,
} from '@/types/debrief';

const reasonOptions: Array<{
  value: DebriefReasonTag;
  label: string;
}> = [
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
    if (!id || !session?.access_token) {
      setErrorMessage('This private debrief could not be opened.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await apiGet<DebriefEnvelope>(
        `/debriefs/${encodeURIComponent(id)}`,
        session.access_token,
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
  }, [id, session?.access_token, signOut]);

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
      !session?.access_token ||
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
        session.access_token,
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
      <SafeAreaView style={styles.screen}>
        <Header />
        <View style={styles.center}>
          <ActivityIndicator color="#352D28" size="large" />
          <Text style={styles.helper}>Opening your private check-in…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView style={styles.screen}>
        <Header />
        <View style={styles.center}>
          <Text style={styles.eyebrow}>UNAVAILABLE</Text>
          <Text style={styles.errorTitle}>
            This debrief could not be opened.
          </Text>
          <Text style={styles.errorBody}>{errorMessage}</Text>
          <Pressable onPress={() => void load()} style={styles.primaryButton}>
            <Text style={styles.primaryText}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const profile = item.counterpart_profile;
  const photo = profile.photos[0]?.url;
  const submitted = item.state === 'submitted';

  if (submitted) {
    return (
      <SafeAreaView style={styles.screen}>
        <Header />
        <View style={styles.center}>
          <View style={styles.successIcon}>
            <Ionicons
              color="#365C4D"
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
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
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
              color="#365C4D"
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
                placeholderTextColor="#9A928A"
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
    </SafeAreaView>
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
  return (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Ionicons color="#352D28" name="chevron-back" size={25} />
      </Pressable>
      <Text style={styles.wordmark}>VOUCH</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: '#F7F4EF' },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 54,
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  backButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  wordmark: {
    color: '#352D28',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 3.2,
  },
  headerSpacer: { width: 40 },
  content: { paddingBottom: 48, paddingHorizontal: 20 },
  personRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    marginTop: 12,
  },
  avatar: {
    backgroundColor: '#EAE4DD',
    borderRadius: 11,
    height: 92,
    width: 76,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: '#776E66',
    fontSize: 30,
    fontWeight: '600',
  },
  personCopy: { flex: 1 },
  eyebrow: {
    color: '#766E67',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  title: {
    color: '#171717',
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 31,
    marginTop: 6,
  },
  dateText: {
    color: '#746D66',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 5,
  },
  privacyCard: {
    alignItems: 'flex-start',
    backgroundColor: '#E5ECE8',
    borderRadius: 11,
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
    padding: 15,
  },
  privacyText: {
    color: '#365C4D',
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  questionCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2DCD5',
    borderRadius: 12,
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
    color: '#282522',
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 23,
  },
  optionalLabel: {
    color: '#8B837B',
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
    borderColor: '#D8D1CA',
    borderRadius: 9,
    borderWidth: 1,
    flex: 1,
    height: 48,
    justifyContent: 'center',
  },
  choiceButtonSelected: {
    backgroundColor: '#352D28',
    borderColor: '#352D28',
  },
  choiceText: {
    color: '#352D28',
    fontSize: 15,
    fontWeight: '700',
  },
  choiceTextSelected: { color: '#FFFFFF' },
  reasonList: { gap: 9, marginTop: 15 },
  reasonButton: {
    alignItems: 'center',
    borderColor: '#DDD6CF',
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  reasonButtonSelected: {
    backgroundColor: '#5A4B43',
    borderColor: '#5A4B43',
  },
  reasonText: {
    color: '#423B36',
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
  },
  reasonTextSelected: { color: '#FFFFFF', fontWeight: '700' },
  noteInput: {
    backgroundColor: '#FBFAF8',
    borderColor: '#DDD6CF',
    borderRadius: 9,
    borderWidth: 1,
    color: '#282522',
    fontSize: 15,
    lineHeight: 21,
    marginTop: 15,
    minHeight: 112,
    padding: 13,
  },
  characterCount: {
    color: '#8B837B',
    fontSize: 11,
    marginTop: 7,
    textAlign: 'right',
  },
  safetyButton: {
    alignItems: 'center',
    borderColor: '#D7A9A3',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  safetyButtonSelected: {
    backgroundColor: '#963E36',
    borderColor: '#963E36',
  },
  safetyText: {
    color: '#963E36',
    fontSize: 14,
    fontWeight: '700',
  },
  safetyTextSelected: { color: '#FFFFFF' },
  inlineError: {
    backgroundColor: '#F6E9E6',
    borderRadius: 9,
    color: '#943D35',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 18,
    padding: 14,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#352D28',
    borderRadius: 10,
    height: 56,
    justifyContent: 'center',
    marginTop: 20,
    paddingHorizontal: 18,
  },
  disabledButton: { opacity: 0.45 },
  primaryText: {
    color: '#FFFFFF',
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
    backgroundColor: '#E5ECE8',
    borderRadius: 34,
    height: 68,
    justifyContent: 'center',
    width: 68,
  },
  successTitle: {
    color: '#1F1D1B',
    fontSize: 25,
    fontWeight: '700',
    marginTop: 20,
    textAlign: 'center',
  },
  successBody: {
    color: '#6F6861',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
    maxWidth: 320,
    textAlign: 'center',
  },
});
