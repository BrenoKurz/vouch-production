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
  View,
} from 'react-native';
import { useCallback, useMemo, useState } from 'react';

import { ApiError, apiGet, apiPost } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import type {
  DateEnvelope,
  DateState,
  VouchDate,
} from '@/types/date';

const labels: Record<DateState, string> = {
  proposed: 'Awaiting confirmation',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  scheduled_time_passed: 'Date completed',
  debrief_pending: 'Debrief pending',
  completed: 'Completed',
  disputed: 'Under review',
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export default function DateDetailScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { session, signOut } = useAuth();

  const [item, setItem] = useState<VouchDate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const startsAt = useMemo(
    () =>
      item
        ? {
            date: formatDate(item.starts_at),
            time: formatTime(item.starts_at),
          }
        : null,
    [item],
  );

  const load = useCallback(async () => {
    if (!id || !session?.access_token) {
      setErrorMessage('This date could not be opened.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await apiGet<DateEnvelope>(
        `/dates/${encodeURIComponent(id)}`,
        session.access_token,
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
  }, [id, session?.access_token, signOut]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function confirm() {
    if (!item || !session?.access_token || isConfirming) return;

    setIsConfirming(true);
    setErrorMessage('');

    try {
      const response = await apiPost<
        DateEnvelope,
        undefined
      >(
        `/dates/${encodeURIComponent(item.id)}/confirm`,
        session.access_token,
        undefined,
        Crypto.randomUUID(),
        { 'If-Match': String(item.version) },
      );

      setItem(response.data);

      Alert.alert(
        'Date confirmed',
        `Your date with ${response.data.counterpart_profile.first_name} is confirmed.`,
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
            'The date changed. We refreshed the latest details.',
          );
          return;
        }

        setErrorMessage(error.message);
      } else {
        setErrorMessage('Unable to confirm this date.');
      }
    } finally {
      setIsConfirming(false);
    }
  }

  function confirmWithAlert() {
    if (!item) return;

    Alert.alert(
      'Confirm this date?',
      `${formatDate(item.starts_at)} at ${formatTime(
        item.starts_at,
      )}`,
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => void confirm(),
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

  if (!item || !startsAt) {
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
            <Text style={styles.name}>
              Date with {profile.first_name}
            </Text>
            <Text style={styles.neighborhood}>
              {profile.neighborhood}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.statusCard,
            item.state === 'confirmed' &&
              styles.confirmedStatusCard,
          ]}
        >
          <Ionicons
            color={
              item.state === 'confirmed' ? '#365C4D' : '#8B4A32'
            }
            name={
              item.state === 'confirmed'
                ? 'checkmark-circle'
                : 'time-outline'
            }
            size={22}
          />
          <View style={styles.statusCopy}>
            <Text
              style={[
                styles.statusTitle,
                item.state === 'confirmed' &&
                  styles.confirmedStatusTitle,
              ]}
            >
              {labels[item.state]}
            </Text>
            <Text style={styles.statusBody}>
              {item.state === 'proposed'
                ? item.can_confirm
                  ? 'Review the details and confirm when you are ready.'
                  : `Waiting for ${profile.first_name} to confirm.`
                : item.state === 'confirmed'
                  ? 'Both of you have confirmed this plan.'
                  : item.state === 'debrief_pending'
                    ? item.can_complete_debrief
                      ? 'Your private post-date check-in is ready.'
                      : 'Your feedback is recorded. Waiting for the other private response.'
                    : item.state === 'completed'
                      ? 'Both private check-ins are complete.'
                      : item.state === 'disputed'
                        ? 'A private concern was reported and is under review.'
                        : 'Vouch will guide the next step.'}
            </Text>
          </View>
        </View>

        <View style={styles.detailCard}>
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Ionicons
                color="#5E5751"
                name="calendar-outline"
                size={20}
              />
            </View>
            <View style={styles.detailCopy}>
              <Text style={styles.detailLabel}>DATE</Text>
              <Text style={styles.detailValue}>
                {startsAt.date}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Ionicons
                color="#5E5751"
                name="time-outline"
                size={20}
              />
            </View>
            <View style={styles.detailCopy}>
              <Text style={styles.detailLabel}>TIME</Text>
              <Text style={styles.detailValue}>
                {startsAt.time}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Ionicons
                color="#5E5751"
                name="location-outline"
                size={20}
              />
            </View>
            <View style={styles.detailCopy}>
              <Text style={styles.detailLabel}>LOCATION</Text>
              <Text style={styles.detailValue}>
                {item.venue?.name ?? 'Decide together'}
              </Text>
              {item.venue?.address_public ? (
                <Text style={styles.detailMeta}>
                  {item.venue.address_public}
                </Text>
              ) : (
                <Text style={styles.detailMeta}>
                  Choose the place in your private conversation.
                </Text>
              )}
            </View>
          </View>
        </View>

        {errorMessage ? (
          <Text style={styles.inlineError}>{errorMessage}</Text>
        ) : null}

        {item.can_confirm ? (
          <Pressable
            disabled={isConfirming}
            onPress={confirmWithAlert}
            style={styles.primaryButton}
          >
            {isConfirming ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryText}>
                Confirm this date
              </Text>
            )}
          </Pressable>
        ) : null}

        {item.can_complete_debrief && item.debrief_id ? (
          <Pressable
            onPress={() =>
              router.push(
                {
                  pathname: '/debrief/[id]',
                  params: { id: item.debrief_id },
                } as Href,
              )
            }
            style={styles.primaryButton}
          >
            <Text style={styles.primaryText}>
              Complete private debrief
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() =>
            router.push(
              {
                pathname: '/conversation/[id]',
                params: { id: item.conversation_id },
              } as Href,
            )
          }
          style={styles.secondaryButton}
        >
          <Ionicons
            color="#352D28"
            name="chatbubble-outline"
            size={18}
          />
          <Text style={styles.secondaryText}>
            Open conversation
          </Text>
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
  name: {
    color: '#171717',
    fontSize: 27,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  neighborhood: {
    color: '#746D66',
    fontSize: 14,
    marginTop: 5,
  },
  statusCard: {
    alignItems: 'flex-start',
    backgroundColor: '#F4E4DB',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    padding: 17,
  },
  confirmedStatusCard: {
    backgroundColor: '#E5ECE8',
  },
  statusCopy: { flex: 1 },
  statusTitle: {
    color: '#7A4432',
    fontSize: 16,
    fontWeight: '800',
  },
  confirmedStatusTitle: { color: '#365C4D' },
  statusBody: {
    color: '#68635D',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
  },
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2DCD5',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 22,
    padding: 18,
  },
  detailRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 13,
  },
  detailIcon: {
    alignItems: 'center',
    backgroundColor: '#EEEAE5',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  detailCopy: { flex: 1 },
  detailLabel: {
    color: '#766E67',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  detailValue: {
    color: '#282522',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 23,
    marginTop: 5,
  },
  detailMeta: {
    color: '#746D66',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  divider: {
    backgroundColor: '#EEE9E3',
    height: 1,
    marginVertical: 17,
  },
  inlineError: {
    backgroundColor: '#F6E9E6',
    borderRadius: 9,
    color: '#943D35',
    fontSize: 14,
    marginTop: 20,
    padding: 14,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#352D28',
    borderRadius: 10,
    height: 56,
    justifyContent: 'center',
    marginTop: 24,
    paddingHorizontal: 28,
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
    flexDirection: 'row',
    gap: 9,
    height: 54,
    justifyContent: 'center',
    marginTop: 12,
  },
  secondaryText: {
    color: '#352D28',
    fontSize: 15,
    fontWeight: '700',
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
    marginTop: 16,
  },
  eyebrow: {
    color: '#766E67',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  errorTitle: {
    color: '#171717',
    fontSize: 28,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  errorBody: {
    color: '#68635D',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
    textAlign: 'center',
  },
});
