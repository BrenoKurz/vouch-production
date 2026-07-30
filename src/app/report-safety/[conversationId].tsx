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
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useCallback, useMemo, useState } from 'react';

import { StackHeader } from '@/components/vouch-ui';
import { layout } from '@/constants/design';
import { ApiError, apiGet, apiPost } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import type {
  Conversation,
  ConversationEnvelope,
} from '@/types/conversation';
import type {
  CreateSafetyCaseBody,
  SafetyCaseEnvelope,
  SafetyCategory,
} from '@/types/safety';

const categories: {
  value: SafetyCategory;
  label: string;
  description: string;
}[] = [
  {
    value: 'harassment',
    label: 'Harassment',
    description: 'Repeated unwanted or degrading behavior',
  },
  {
    value: 'coercion',
    label: 'Coercion or pressure',
    description: 'Pressure, control, or refusal to respect boundaries',
  },
  {
    value: 'threats',
    label: 'Threats',
    description: 'Threatening language or behavior',
  },
  {
    value: 'physical_safety',
    label: 'Physical safety',
    description: 'Violence, stalking, or unsafe physical conduct',
  },
  {
    value: 'sexual_misconduct',
    label: 'Sexual misconduct',
    description: 'Non-consensual or inappropriate sexual behavior',
  },
  {
    value: 'fraud',
    label: 'Fraud or financial concern',
    description: 'Scams, requests for money, or deceptive conduct',
  },
  {
    value: 'impersonation',
    label: 'Impersonation',
    description: 'False identity or misleading profile information',
  },
  {
    value: 'other',
    label: 'Something else',
    description: 'Another concern Vouch should review',
  },
];

export default function ReportSafetyScreen() {
  const params = useLocalSearchParams<{
    conversationId?: string | string[];
    dateId?: string | string[];
  }>();
  const conversationId = Array.isArray(params.conversationId)
    ? params.conversationId[0]
    : params.conversationId;
  const dateId = Array.isArray(params.dateId)
    ? params.dateId[0]
    : params.dateId;

  const { session, signOut } = useAuth();
  const accessToken = session?.access_token;

  const [conversation, setConversation] =
    useState<Conversation | null>(null);
  const [category, setCategory] =
    useState<SafetyCategory | null>(null);
  const [narrative, setNarrative] = useState('');
  const [immediateDanger, setImmediateDanger] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const canSubmit = useMemo(
    () =>
      Boolean(category) &&
      narrative.trim().length >= 10 &&
      narrative.trim().length <= 5000 &&
      !isSubmitting,
    [category, narrative, isSubmitting],
  );

  const load = useCallback(async () => {
    if (!conversationId || !accessToken) {
      setErrorMessage('This connection could not be opened.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await apiGet<ConversationEnvelope>(
        `/conversations/${encodeURIComponent(conversationId)}`,
        accessToken,
      );
      setConversation(response.data);
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
          : 'Unable to prepare the safety report.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, conversationId, signOut]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function submit() {
    if (
      !conversation ||
      !accessToken ||
      !category ||
      !canSubmit
    ) {
      setErrorMessage(
        'Choose a category and provide at least 10 characters.',
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const body: CreateSafetyCaseBody = {
        conversation_id: conversation.id,
        date_id: dateId ?? null,
        category,
        narrative: narrative.trim(),
        immediate_danger: immediateDanger,
      };

      const response = await apiPost<
        SafetyCaseEnvelope,
        CreateSafetyCaseBody
      >(
        '/safety-cases',
        accessToken,
        body,
        Crypto.randomUUID(),
      );

      Alert.alert(
        'Report submitted privately',
        immediateDanger
          ? 'Vouch has received your urgent report. Contact local emergency services now if you are in immediate danger.'
          : 'The connection has been closed and the Vouch team can review your report.',
        [
          {
            text: 'View report',
            onPress: () =>
              router.replace(
                {
                  pathname: '/safety-case/[id]',
                  params: { id: response.data.id },
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

        setErrorMessage(error.message);
      } else {
        setErrorMessage('Unable to submit the safety report.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function confirmSubmit() {
    Alert.alert(
      'Submit this private report?',
      'Submitting immediately closes this connection for safety. The other member will not see your report, evidence, or case updates.',
      [
        { text: 'Review', style: 'cancel' },
        {
          text: 'Submit report',
          style: 'destructive',
          onPress: () => void submit(),
        },
      ],
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.screen}>
        <Header />
        <View style={styles.center}>
          <ActivityIndicator color="#352D28" size="large" />
          <Text style={styles.helper}>
            Preparing private reporting…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!conversation) {
    return (
      <SafeAreaView style={styles.screen}>
        <Header />
        <View style={styles.center}>
          <Text style={styles.eyebrow}>UNAVAILABLE</Text>
          <Text style={styles.errorTitle}>
            This report could not be opened.
          </Text>
          <Text style={styles.errorBody}>{errorMessage}</Text>
          <Pressable
            onPress={() => void load()}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryText}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const counterpartName =
    conversation.counterpart_profile.first_name;

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
          <Text style={styles.eyebrow}>PRIVATE SAFETY REPORT</Text>
          <Text style={styles.title}>
            Report a concern about {counterpartName}
          </Text>
          <Text style={styles.body}>
            Your report is private. {counterpartName} will not see
            your description, evidence, or case updates.
          </Text>

          <View style={styles.emergencyCard}>
            <Ionicons
              color="#943D35"
              name="warning-outline"
              size={22}
            />
            <View style={styles.emergencyCopy}>
              <Text style={styles.emergencyTitle}>
                Vouch is not an emergency service
              </Text>
              <Text style={styles.emergencyBody}>
                Contact local emergency services immediately when
                you or someone else may be in immediate danger.
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              WHAT BEST DESCRIBES THE CONCERN?
            </Text>

            <View style={styles.categoryList}>
              {categories.map((option) => {
                const selected = category === option.value;

                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      setCategory(option.value);
                      setErrorMessage('');
                    }}
                    style={[
                      styles.categoryCard,
                      selected && styles.categoryCardSelected,
                    ]}
                  >
                    <View style={styles.categoryCopy}>
                      <Text
                        style={[
                          styles.categoryLabel,
                          selected &&
                            styles.categoryLabelSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                      <Text
                        style={[
                          styles.categoryDescription,
                          selected &&
                            styles.categoryDescriptionSelected,
                        ]}
                      >
                        {option.description}
                      </Text>
                    </View>
                    <Ionicons
                      color={selected ? '#FFFFFF' : '#8A827A'}
                      name={
                        selected
                          ? 'checkmark-circle'
                          : 'ellipse-outline'
                      }
                      size={21}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              DESCRIBE WHAT HAPPENED
            </Text>
            <TextInput
              editable={!isSubmitting}
              maxLength={5000}
              multiline
              onChangeText={(value) => {
                setNarrative(value);
                setErrorMessage('');
              }}
              placeholder="Include the details that would help Vouch understand and review the concern."
              placeholderTextColor="#9A928B"
              style={styles.input}
              textAlignVertical="top"
              value={narrative}
            />
            <Text style={styles.characterCount}>
              {narrative.length}/5000
            </Text>
          </View>

          <View style={styles.dangerRow}>
            <View style={styles.dangerCopy}>
              <Text style={styles.dangerTitle}>
                Is anyone in immediate danger?
              </Text>
              <Text style={styles.dangerBody}>
                This marks the report urgent. Contact emergency
                services separately.
              </Text>
            </View>
            <Switch
              onValueChange={setImmediateDanger}
              trackColor={{
                false: '#D8D1CA',
                true: '#B95B51',
              }}
              value={immediateDanger}
            />
          </View>

          <View style={styles.privacyCard}>
            <Ionicons
              color="#365C4D"
              name="shield-checkmark-outline"
              size={21}
            />
            <Text style={styles.privacyText}>
              Submitting closes the conversation and any related
              date plan immediately. Evidence can be attached after
              the report is created.
            </Text>
          </View>

          {errorMessage ? (
            <Text style={styles.inlineError}>{errorMessage}</Text>
          ) : null}

          <Pressable
            disabled={!canSubmit}
            onPress={confirmSubmit}
            style={[
              styles.dangerButton,
              !canSubmit && styles.disabledButton,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.dangerButtonText}>
                Submit private report
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() =>
              router.push('/safety-cases' as Href)
            }
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryText}>
              View your safety reports
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Header() {
  return <StackHeader />;
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
  content: {
    alignSelf: 'center',
    maxWidth: layout.contentMaxWidth,
    paddingBottom: 48,
    paddingHorizontal: 20,
    width: '100%',
  },
  eyebrow: {
    color: '#766E67',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
    marginTop: 12,
  },
  title: {
    color: '#171717',
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.8,
    lineHeight: 37,
    marginTop: 10,
  },
  body: {
    color: '#68635D',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
  },
  emergencyCard: {
    alignItems: 'flex-start',
    backgroundColor: '#F6E9E6',
    borderRadius: 11,
    flexDirection: 'row',
    gap: 11,
    marginTop: 22,
    padding: 15,
  },
  emergencyCopy: { flex: 1 },
  emergencyTitle: {
    color: '#943D35',
    fontSize: 14,
    fontWeight: '800',
  },
  emergencyBody: {
    color: '#7A4A45',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  section: { marginTop: 28 },
  sectionTitle: {
    color: '#716961',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  categoryList: { gap: 9, marginTop: 12 },
  categoryCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#DDD6CF',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 64,
    padding: 14,
  },
  categoryCardSelected: {
    backgroundColor: '#5A4B43',
    borderColor: '#5A4B43',
  },
  categoryCopy: { flex: 1 },
  categoryLabel: {
    color: '#2D2926',
    fontSize: 15,
    fontWeight: '800',
  },
  categoryLabelSelected: { color: '#FFFFFF' },
  categoryDescription: {
    color: '#746D66',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  categoryDescriptionSelected: { color: '#E8E0DA' },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDD6CF',
    borderRadius: 10,
    borderWidth: 1,
    color: '#282522',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
    minHeight: 154,
    padding: 14,
  },
  characterCount: {
    color: '#8B837B',
    fontSize: 11,
    marginTop: 7,
    textAlign: 'right',
  },
  dangerRow: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#DDD6CF',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    marginTop: 25,
    padding: 15,
  },
  dangerCopy: { flex: 1 },
  dangerTitle: {
    color: '#2D2926',
    fontSize: 15,
    fontWeight: '800',
  },
  dangerBody: {
    color: '#746D66',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  privacyCard: {
    alignItems: 'flex-start',
    backgroundColor: '#E5ECE8',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    padding: 15,
  },
  privacyText: {
    color: '#365C4D',
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  inlineError: {
    backgroundColor: '#F6E9E6',
    borderRadius: 9,
    color: '#943D35',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 18,
    padding: 14,
  },
  dangerButton: {
    alignItems: 'center',
    backgroundColor: '#943D35',
    borderRadius: 10,
    justifyContent: 'center',
    marginTop: 22,
    minHeight: 54,
    paddingHorizontal: 18,
  },
  dangerButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  disabledButton: { opacity: 0.45 },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#CFC7BF',
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 52,
    paddingHorizontal: 18,
  },
  secondaryText: {
    color: '#352D28',
    fontSize: 15,
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
    fontSize: 15,
    marginTop: 12,
  },
  errorTitle: {
    color: '#1F1D1B',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 10,
    textAlign: 'center',
  },
  errorBody: {
    color: '#6F6861',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 9,
    textAlign: 'center',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#352D28',
    borderRadius: 10,
    justifyContent: 'center',
    marginTop: 22,
    minHeight: 52,
    paddingHorizontal: 20,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
