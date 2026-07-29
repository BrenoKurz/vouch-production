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
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useCallback, useState } from 'react';

import { ApiError, apiGet, apiPost } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import type {
  DateCancellationRequest,
  DateEnvelope,
  VouchDate,
} from '@/types/date';

export default function CancelDateScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { session, signOut } = useAuth();
  const accessToken = session?.access_token;

  const [item, setItem] = useState<VouchDate | null>(null);
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const load = useCallback(async () => {
    if (!id || !accessToken) {
      setErrorMessage('This date could not be opened.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await apiGet<DateEnvelope>(
        `/dates/${encodeURIComponent(id)}`,
        accessToken,
      );
      setItem(response.data);
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
          : 'Unable to load this date.',
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

  async function submit() {
    if (!item || !accessToken || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const response = await apiPost<DateEnvelope, DateCancellationRequest>(
        `/dates/${encodeURIComponent(item.id)}/cancel`,
        accessToken,
        {
          reason: reason.trim() || null,
        },
        Crypto.randomUUID(),
        { 'If-Match': String(item.version) },
      );

      Alert.alert(
        'Date cancelled',
        'The plan was cancelled. You can still reschedule from the date page.',
        [
          {
            text: 'View date',
            onPress: () =>
              router.replace(
                {
                  pathname: '/date/[id]',
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

        if (
          error.code === 'version_conflict' ||
          error.code === 'state_conflict'
        ) {
          await load();
          setErrorMessage(
            'The date changed. Review the latest details before trying again.',
          );
          return;
        }

        setErrorMessage(error.message);
      } else {
        setErrorMessage('Unable to cancel this date.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function confirmCancellation() {
    if (!item) return;

    Alert.alert(
      'Cancel this date?',
      `This will notify ${item.counterpart_profile.first_name} and reopen the conversation.`,
      [
        { text: 'Keep date', style: 'cancel' },
        {
          text: 'Cancel date',
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
          <Text style={styles.helper}>Opening your date…</Text>
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
            This date could not be opened.
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

  return (
    <SafeAreaView style={styles.screen}>
      <Header />

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
            <Text style={styles.eyebrow}>CHANGE OF PLANS</Text>
            <Text style={styles.title}>
              Cancel your date with {profile.first_name}
            </Text>
          </View>
        </View>

        <Text style={styles.body}>
          Cancelling clears both confirmations and reopens the private
          conversation. Either person can propose a replacement plan later.
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>OPTIONAL REASON</Text>
          <TextInput
            editable={!isSubmitting}
            maxLength={500}
            multiline
            onChangeText={setReason}
            placeholder="A brief note about the change of plans"
            placeholderTextColor="#9A928B"
            style={styles.input}
            textAlignVertical="top"
            value={reason}
          />
          <Text style={styles.characterCount}>
            {reason.length}/500
          </Text>
        </View>

        {!item.can_cancel ? (
          <View style={styles.unavailableCard}>
            <Text style={styles.unavailableTitle}>
              This date can no longer be cancelled.
            </Text>
            <Text style={styles.unavailableBody}>
              Return to the date page to review its latest state.
            </Text>
          </View>
        ) : null}

        {errorMessage ? (
          <Text style={styles.inlineError}>{errorMessage}</Text>
        ) : null}

        {item.can_cancel ? (
          <Pressable
            disabled={isSubmitting}
            onPress={confirmCancellation}
            style={styles.dangerButton}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.dangerText}>Cancel this date</Text>
            )}
          </Pressable>
        ) : null}

        <Pressable
          onPress={() =>
            router.replace(
              {
                pathname: '/date/[id]',
                params: { id: item.id },
              } as Href,
            )
          }
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryText}>Keep the current plan</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
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
  content: { paddingBottom: 42, paddingHorizontal: 20 },
  personRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    marginTop: 12,
  },
  avatar: {
    backgroundColor: '#EAE4DD',
    borderRadius: 11,
    height: 82,
    width: 70,
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
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  title: {
    color: '#171717',
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.6,
    lineHeight: 32,
    marginTop: 7,
  },
  body: {
    color: '#68635D',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 24,
  },
  section: { marginTop: 30 },
  sectionTitle: {
    color: '#716961',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDD5CE',
    borderRadius: 10,
    borderWidth: 1,
    color: '#292522',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
    minHeight: 132,
    padding: 15,
  },
  characterCount: {
    color: '#8A827A',
    fontSize: 12,
    marginTop: 7,
    textAlign: 'right',
  },
  unavailableCard: {
    backgroundColor: '#EEEAE5',
    borderRadius: 10,
    marginTop: 24,
    padding: 16,
  },
  unavailableTitle: {
    color: '#352D28',
    fontSize: 15,
    fontWeight: '800',
  },
  unavailableBody: {
    color: '#68635D',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  inlineError: {
    color: '#8D3933',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 18,
  },
  dangerButton: {
    alignItems: 'center',
    backgroundColor: '#8D3933',
    borderRadius: 10,
    justifyContent: 'center',
    marginTop: 24,
    minHeight: 52,
    paddingHorizontal: 18,
  },
  dangerText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#D8D1CA',
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
