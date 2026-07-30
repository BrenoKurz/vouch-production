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
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
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
  DateProposalRequest,
  DateEnvelope,
  Venue,
  VenuesEnvelope,
} from '@/types/date';

function initialDate() {
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

export default function ScheduleDateScreen() {
  const params = useLocalSearchParams<{
    conversationId?: string | string[];
  }>();
  const conversationId = Array.isArray(params.conversationId)
    ? params.conversationId[0]
    : params.conversationId;

  const { session, signOut } = useAuth();
  const accessToken = session?.access_token;

  const [conversation, setConversation] =
    useState<Conversation | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenueId, setSelectedVenueId] =
    useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState(initialDate);
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
    if (!conversationId || !accessToken) {
      setErrorMessage('This conversation could not be opened.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const [conversationResponse, venuesResponse] =
        await Promise.all([
          apiGet<ConversationEnvelope>(
            `/conversations/${encodeURIComponent(conversationId)}`,
            accessToken,
          ),
          apiGet<VenuesEnvelope>(
            '/venues',
            accessToken,
          ),
        ]);

      setConversation(conversationResponse.data);
      setVenues(venuesResponse.data);
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
          : 'Unable to prepare the date proposal.',
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
      isSubmitting
    ) {
      return;
    }

    if (scheduledAt.getTime() <= Date.now()) {
      setErrorMessage('Choose a date and time in the future.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const response = await apiPost<DateEnvelope, DateProposalRequest>(
        `/conversations/${encodeURIComponent(
          conversation.id,
        )}/dates`,
        accessToken,
        {
          scheduled_at: scheduledAt.toISOString(),
          venue_id: selectedVenueId,
        },
        Crypto.randomUUID(),
        { 'If-Match': String(conversation.version) },
      );

      Alert.alert(
        'Date proposed',
        `Your proposal was sent to ${conversation.counterpart_profile.first_name}.`,
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
            'The conversation changed. Review the latest state and try again.',
          );
          return;
        }

        setErrorMessage(error.message);
      } else {
        setErrorMessage('Unable to propose this date.');
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
          <Text style={styles.helper}>
            Preparing your date proposal…
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
            This date cannot be scheduled.
          </Text>
          <Text style={styles.errorBody}>{errorMessage}</Text>
          <Pressable onPress={() => void load()} style={styles.primaryButton}>
            <Text style={styles.primaryText}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const canPropose =
    conversation.available_actions.includes('propose_date');

  return (
    <SafeAreaView style={styles.screen}>
      <Header />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>PLAN WITH INTENTION</Text>
        <Text style={styles.title}>
          Propose a date with{' '}
          {conversation.counterpart_profile.first_name}
        </Text>
        <Text style={styles.body}>
          Choose a time that works for you. They will confirm before
          the date is finalized.
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DATE AND TIME</Text>

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
                Confirm the time now and choose the place in your
                conversation.
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

        {selectedVenue ? (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>
              Your proposal
            </Text>
            <Text style={styles.summaryText}>
              {formatSelection(scheduledAt)}
            </Text>
            <Text style={styles.summaryText}>
              {selectedVenue.name}
            </Text>
          </View>
        ) : null}

        {errorMessage ? (
          <Text style={styles.inlineError}>{errorMessage}</Text>
        ) : null}

        {!canPropose ? (
          <View style={styles.unavailableCard}>
            <Text style={styles.unavailableTitle}>
              A date can no longer be proposed here.
            </Text>
            <Text style={styles.unavailableBody}>
              Return to the conversation to review its latest state.
            </Text>
          </View>
        ) : (
          <Pressable
            disabled={isSubmitting}
            onPress={() => void submit()}
            style={styles.primaryButton}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryText}>
                Send date proposal
              </Text>
            )}
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Header() {
  return <StackHeader />;
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
  content: {
    alignSelf: 'center',
    maxWidth: layout.contentMaxWidth,
    paddingBottom: 42,
    paddingHorizontal: 20,
    width: '100%',
  },
  eyebrow: {
    color: '#766E67',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  title: {
    color: '#171717',
    fontSize: 32,
    fontWeight: '600',
    letterSpacing: -0.8,
    lineHeight: 39,
    marginTop: 12,
  },
  body: {
    color: '#68635D',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
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
    color: '#29483B',
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  pickerCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2DCD5',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    overflow: 'hidden',
    paddingVertical: 4,
  },
  venueCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2DCD5',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    padding: 15,
  },
  selectedVenueCard: {
    backgroundColor: '#F0F4F1',
    borderColor: '#9CB2A7',
  },
  venueIcon: {
    alignItems: 'center',
    backgroundColor: '#EEEAE5',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  venueCopy: { flex: 1 },
  venueName: {
    color: '#272421',
    fontSize: 15,
    fontWeight: '700',
  },
  venueMeta: {
    color: '#746D66',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  venueHelper: {
    color: '#827A73',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2DCD5',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 28,
    padding: 18,
  },
  summaryTitle: {
    color: '#282522',
    fontSize: 16,
    fontWeight: '700',
  },
  summaryText: {
    color: '#68635D',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 7,
  },
  inlineError: {
    backgroundColor: '#F6E9E6',
    borderRadius: 9,
    color: '#943D35',
    fontSize: 14,
    marginTop: 20,
    padding: 14,
  },
  unavailableCard: {
    backgroundColor: '#EEEAE5',
    borderRadius: 10,
    marginTop: 28,
    padding: 18,
  },
  unavailableTitle: {
    color: '#282522',
    fontSize: 16,
    fontWeight: '700',
  },
  unavailableBody: {
    color: '#68635D',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 7,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#352D28',
    borderRadius: 10,
    height: 56,
    justifyContent: 'center',
    marginTop: 28,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 16,
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
