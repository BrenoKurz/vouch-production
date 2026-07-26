import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
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
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useCallback, useMemo, useState } from 'react';

import { ApiError, apiGet, apiPost } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import type {
  DateEnvelope,
  Venue,
  VenuesEnvelope,
  VouchDate,
} from '@/types/date';

function fallbackDate() {
  const value = new Date();
  value.setDate(value.getDate() + 1);
  value.setHours(19, 0, 0, 0);
  return value;
}

function formatSelection(value: Date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(value);
}

export default function RescheduleDateScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { session, signOut } = useAuth();

  const [item, setItem] = useState<VouchDate | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenueId, setSelectedVenueId] =
    useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState(fallbackDate);
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const selectedVenue = useMemo(
    () =>
      venues.find((venue) => venue.id === selectedVenueId) ??
      null,
    [selectedVenueId, venues],
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
      const [dateResponse, venuesResponse] = await Promise.all([
        apiGet<DateEnvelope>(
          `/dates/${encodeURIComponent(id)}`,
          session.access_token,
        ),
        apiGet<VenuesEnvelope>(
          '/venues',
          session.access_token,
        ),
      ]);

      setItem(dateResponse.data);
      setVenues(venuesResponse.data);
      setSelectedVenueId(dateResponse.data.venue_id);

      const current = new Date(dateResponse.data.starts_at);
      setScheduledAt(
        Number.isNaN(current.getTime()) ? fallbackDate() : current,
      );
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
          : 'Unable to prepare rescheduling.',
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

  async function submit() {
    if (!item || !session?.access_token || isSubmitting) return;

    if (scheduledAt.getTime() <= Date.now()) {
      setErrorMessage('Choose a date and time in the future.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const response = await apiPost<
        DateEnvelope,
        {
          scheduled_at: string;
          venue_id: string | null;
          reason: string | null;
        }
      >(
        `/dates/${encodeURIComponent(item.id)}/reschedule`,
        session.access_token,
        {
          scheduled_at: scheduledAt.toISOString(),
          venue_id: selectedVenueId,
          reason: reason.trim() || null,
        },
        Crypto.randomUUID(),
        { 'If-Match': String(item.version) },
      );

      Alert.alert(
        'New date proposed',
        `${response.data.counterpart_profile.first_name} will need to confirm the updated plan.`,
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
            'The date changed. Review the latest details and try again.',
          );
          return;
        }

        setErrorMessage(error.message);
      } else {
        setErrorMessage('Unable to reschedule this date.');
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
          <Text style={styles.helper}>Preparing rescheduling…</Text>
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
            <Text style={styles.eyebrow}>UPDATE THE PLAN</Text>
            <Text style={styles.title}>
              Reschedule with {profile.first_name}
            </Text>
          </View>
        </View>

        <Text style={styles.body}>
          Your confirmation will be recorded immediately. The updated
          plan becomes confirmed after {profile.first_name} accepts it.
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NEW DATE AND TIME</Text>

          <View style={styles.selectionCard}>
            <Ionicons
              color="#365C4D"
              name="calendar-outline"
              size={22}
            />
            <Text style={styles.selectionText}>
              {formatSelection(scheduledAt)}
            </Text>
          </View>

          <View style={styles.pickerCard}>
            <DateTimePicker
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              minimumDate={new Date()}
              mode="date"
              onChange={(_, value) => {
                if (!value) return;
                const next = new Date(scheduledAt);
                next.setFullYear(
                  value.getFullYear(),
                  value.getMonth(),
                  value.getDate(),
                );
                setScheduledAt(next);
              }}
              value={scheduledAt}
            />
          </View>

          <View style={styles.pickerCard}>
            <DateTimePicker
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              mode="time"
              onChange={(_, value) => {
                if (!value) return;
                const next = new Date(scheduledAt);
                next.setHours(
                  value.getHours(),
                  value.getMinutes(),
                  0,
                  0,
                );
                setScheduledAt(next);
              }}
              value={scheduledAt}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LOCATION</Text>

          <Pressable
            onPress={() => setSelectedVenueId(null)}
            style={[
              styles.venueCard,
              selectedVenueId === null &&
                styles.selectedVenueCard,
            ]}
          >
            <View style={styles.venueIcon}>
              <Ionicons
                color="#5E5751"
                name="chatbubbles-outline"
                size={20}
              />
            </View>
            <View style={styles.venueCopy}>
              <Text style={styles.venueName}>
                Decide together
              </Text>
              <Text style={styles.venueMeta}>
                Choose the place in your private conversation.
              </Text>
            </View>
            {selectedVenueId === null ? (
              <Ionicons
                color="#365C4D"
                name="checkmark-circle"
                size={22}
              />
            ) : null}
          </Pressable>

          {venues.map((venue) => {
            const selected = venue.id === selectedVenueId;

            return (
              <Pressable
                key={venue.id}
                onPress={() => setSelectedVenueId(venue.id)}
                style={[
                  styles.venueCard,
                  selected && styles.selectedVenueCard,
                ]}
              >
                <View style={styles.venueIcon}>
                  <Ionicons
                    color="#5E5751"
                    name="location-outline"
                    size={20}
                  />
                </View>
                <View style={styles.venueCopy}>
                  <Text style={styles.venueName}>
                    {venue.name}
                  </Text>
                  <Text style={styles.venueMeta}>
                    {[
                      venue.neighborhood,
                      venue.address_public,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                {selected ? (
                  <Ionicons
                    color="#365C4D"
                    name="checkmark-circle"
                    size={22}
                  />
                ) : null}
              </Pressable>
            );
          })}

          {venues.length === 0 ? (
            <Text style={styles.venueHelper}>
              Curated Vouch venues will appear here when available.
            </Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>OPTIONAL NOTE</Text>
          <TextInput
            editable={!isSubmitting}
            maxLength={500}
            multiline
            onChangeText={setReason}
            placeholder="Why the plan is changing"
            placeholderTextColor="#9A928B"
            style={styles.input}
            textAlignVertical="top"
            value={reason}
          />
          <Text style={styles.characterCount}>
            {reason.length}/500
          </Text>
        </View>

        {selectedVenue ? (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Updated plan</Text>
            <Text style={styles.summaryText}>
              {formatSelection(scheduledAt)}
            </Text>
            <Text style={styles.summaryText}>
              {selectedVenue.name}
            </Text>
          </View>
        ) : null}

        {!item.can_reschedule ? (
          <View style={styles.unavailableCard}>
            <Text style={styles.unavailableTitle}>
              This date can no longer be rescheduled.
            </Text>
            <Text style={styles.unavailableBody}>
              Return to the date page to review its latest state.
            </Text>
          </View>
        ) : null}

        {errorMessage ? (
          <Text style={styles.inlineError}>{errorMessage}</Text>
        ) : null}

        {item.can_reschedule ? (
          <Pressable
            disabled={isSubmitting}
            onPress={() => void submit()}
            style={styles.primaryButton}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryText}>
                Send updated proposal
              </Text>
            )}
          </Pressable>
        ) : null}
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
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.7,
    lineHeight: 34,
    marginTop: 7,
  },
  body: {
    color: '#68635D',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 22,
  },
  section: { marginTop: 30 },
  sectionTitle: {
    color: '#716961',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  selectionCard: {
    alignItems: 'center',
    backgroundColor: '#E8ECE9',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 11,
    marginTop: 12,
    padding: 16,
  },
  selectionText: {
    color: '#29473B',
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 21,
  },
  pickerCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E0D9D2',
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
    overflow: 'hidden',
    paddingVertical: 4,
  },
  venueCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E0D9D2',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    padding: 14,
  },
  selectedVenueCard: {
    backgroundColor: '#F0F4F1',
    borderColor: '#9CB1A7',
  },
  venueIcon: {
    alignItems: 'center',
    backgroundColor: '#EEEAE5',
    borderRadius: 8,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  venueCopy: { flex: 1 },
  venueName: {
    color: '#2C2926',
    fontSize: 15,
    fontWeight: '800',
  },
  venueMeta: {
    color: '#756E67',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  venueHelper: {
    color: '#756E67',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
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
    minHeight: 112,
    padding: 15,
  },
  characterCount: {
    color: '#8A827A',
    fontSize: 12,
    marginTop: 7,
    textAlign: 'right',
  },
  summaryCard: {
    backgroundColor: '#EEEAE5',
    borderRadius: 10,
    marginTop: 28,
    padding: 16,
  },
  summaryTitle: {
    color: '#352D28',
    fontSize: 15,
    fontWeight: '800',
  },
  summaryText: {
    color: '#68635D',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
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
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#352D28',
    borderRadius: 10,
    justifyContent: 'center',
    marginTop: 24,
    minHeight: 52,
    paddingHorizontal: 18,
  },
  primaryText: {
    color: '#FFFFFF',
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
});
