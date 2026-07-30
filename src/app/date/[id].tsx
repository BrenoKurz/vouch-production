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
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useCallback, useMemo, useState } from 'react';

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
  const accessToken = session?.access_token;

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

  async function confirm() {
    if (!item || !accessToken || isConfirming) return;

    setIsConfirming(true);
    setErrorMessage('');

    try {
      const response = await apiPost<
        DateEnvelope,
        undefined
      >(
        `/dates/${encodeURIComponent(item.id)}/confirm`,
        accessToken,
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

  async function shareDatePlan() {
    if (!item) {
      return;
    }

    const venue = item.venue?.name ?? "Venue still being decided";
    const address = item.venue?.address_public
      ? `\n${item.venue.address_public}`
      : "";

    try {
      await Share.share({
        title: `Vouch date with ${item.counterpart_profile.first_name}`,
        message: [
          "My Vouch date plan",
          `With: ${item.counterpart_profile.first_name}`,
          `When: ${formatDate(item.starts_at)} at ${formatTime(
            item.starts_at,
          )}`,
          `Where: ${venue}${address}`,
          "",
          "I’m sharing this with someone I trust. Vouch safety and support are available in the app.",
        ].join("\n"),
      });
    } catch {
      setErrorMessage("We could not open the share sheet.");
    }
  }

  async function openVenueMap() {
    const address = item?.venue?.address_public;

    if (!address) {
      return;
    }

    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      address,
    )}`;

    try {
      await Linking.openURL(url);
    } catch {
      setErrorMessage("We could not open this location in maps.");
    }
  }

  if (isLoading) {
    return (
      <AppScreen includeBottomInset>
        <Header />
        <LoadingState label="Opening your date plan…" />
      </AppScreen>
    );
  }

  if (!item || !startsAt) {
    return (
      <AppScreen includeBottomInset>
        <Header />
        <ErrorState
          body={errorMessage}
          onRetry={() => void load()}
          title="This date could not be opened"
        />
      </AppScreen>
    );
  }

  const profile = item.counterpart_profile;
  const photo = profile.photos[0]?.url;

  return (
    <AppScreen includeBottomInset>
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
              item.state === 'confirmed' ? palette.sage : palette.amber
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
                      : item.state === 'cancelled'
                        ? 'This plan was cancelled. Either of you can propose a new date.'
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
                color={palette.inkSoft}
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
                color={palette.inkSoft}
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
                color={palette.inkSoft}
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

        {item.state === 'proposed' || item.state === 'confirmed' ? (
          <View style={styles.safetyPlan}>
            <View style={styles.safetyPlanHeader}>
              <View style={styles.safetyPlanIcon}>
                <Ionicons
                  color={palette.sage}
                  name="shield-checkmark-outline"
                  size={23}
                />
              </View>
              <View style={styles.safetyPlanCopy}>
                <Text style={styles.safetyPlanEyebrow}>DATE SAFETY PLAN</Text>
                <Text style={styles.safetyPlanTitle}>
                  Share the plan with someone you trust
                </Text>
              </View>
            </View>
            <Text style={styles.safetyPlanBody}>
              Vouch prepares the date, but you stay in control. Meet in public,
              keep your own transportation available, and let a trusted person
              know the plan.
            </Text>
            <View style={styles.safetyChecks}>
              {[
                'Trusted contact has the details',
                'Public venue and independent ride',
                'Easy exit plan if anything feels off',
              ].map((label) => (
                <View key={label} style={styles.safetyCheck}>
                  <Ionicons
                    color={palette.sage}
                    name="checkmark-circle-outline"
                    size={18}
                  />
                  <Text style={styles.safetyCheckText}>{label}</Text>
                </View>
              ))}
            </View>
            <View style={styles.safetyPlanActions}>
              <Pressable
                accessibilityHint="Opens your device share sheet with this date plan"
                accessibilityRole="button"
                onPress={() => void shareDatePlan()}
                style={({ pressed }) => [
                  styles.shareButton,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  color={palette.white}
                  name="share-outline"
                  size={18}
                />
                <Text style={styles.shareButtonText}>Share date plan</Text>
              </Pressable>
              {item.venue?.address_public ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void openVenueMap()}
                  style={({ pressed }) => [
                    styles.mapButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    color={palette.brand}
                    name="navigate-outline"
                    size={18}
                  />
                  <Text style={styles.mapButtonText}>Open in maps</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        {item.reschedule_count > 0 ? (
          <Text
            style={[
              styles.detailMeta,
              { marginTop: 12, textAlign: 'center' },
            ]}
          >
            This plan has been updated {item.reschedule_count}{' '}
            {item.reschedule_count === 1 ? 'time' : 'times'}.
          </Text>
        ) : null}

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
              <ActivityIndicator color={palette.white} />
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

        {item.can_reschedule ? (
          <Pressable
            onPress={() =>
              router.push(
                {
                  pathname: '/reschedule-date/[id]',
                  params: { id: item.id },
                } as Href,
              )
            }
            style={styles.secondaryButton}
          >
            <Ionicons
              color={palette.ink}
              name="calendar-outline"
              size={18}
            />
            <Text style={styles.secondaryText}>
              {item.state === 'cancelled'
                ? 'Propose a new date'
                : 'Reschedule date'}
            </Text>
          </Pressable>
        ) : null}

        {item.can_cancel ? (
          <Pressable
            onPress={() =>
              router.push(
                {
                  pathname: '/cancel-date/[id]',
                  params: { id: item.id },
                } as Href,
              )
            }
            style={[
              styles.secondaryButton,
              { borderColor: palette.brandSoftStrong },
            ]}
          >
            <Ionicons
              color={palette.danger}
              name="close-circle-outline"
              size={18}
            />
            <Text
              style={[
                styles.secondaryText,
                { color: palette.danger },
              ]}
            >
              Cancel date
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() =>
            router.push(
              {
                pathname:
                  '/report-safety/[conversationId]',
                params: {
                  conversationId: item.conversation_id,
                  dateId: item.id,
                },
              } as Href,
            )
          }
          style={[
            styles.secondaryButton,
            { borderColor: palette.brandSoftStrong },
          ]}
        >
          <Ionicons
            color={palette.danger}
            name="shield-outline"
            size={18}
          />
          <Text
            style={[
              styles.secondaryText,
              { color: palette.danger },
            ]}
          >
            Report a safety concern
          </Text>
        </Pressable>

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
            color={palette.ink}
            name="chatbubble-outline"
            size={18}
          />
          <Text style={styles.secondaryText}>
            Open conversation
          </Text>
        </Pressable>
      </ScrollView>
    </AppScreen>
  );
}

function Header() {
  return <StackHeader />;
}

const styles = StyleSheet.create({
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
    height: 82,
    width: 70,
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
  name: {
    color: palette.ink,
    fontSize: 27,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  neighborhood: {
    color: palette.muted,
    fontSize: 14,
    marginTop: 5,
  },
  statusCard: {
    alignItems: 'flex-start',
    backgroundColor: palette.amberSoft,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    padding: 17,
  },
  confirmedStatusCard: {
    backgroundColor: palette.sageSoft,
  },
  statusCopy: { flex: 1 },
  statusTitle: {
    color: palette.amber,
    fontSize: 16,
    fontWeight: '800',
  },
  confirmedStatusTitle: { color: palette.sage },
  statusBody: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
  },
  detailCard: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radius.md,
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
    backgroundColor: palette.canvasStrong,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  detailCopy: { flex: 1 },
  detailLabel: {
    color: palette.brand,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  detailValue: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 23,
    marginTop: 5,
  },
  detailMeta: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  divider: {
    backgroundColor: palette.border,
    height: 1,
    marginVertical: 17,
  },
  safetyPlan: {
    backgroundColor: palette.sageSoft,
    borderColor: '#C9DCD2',
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: space.xl,
    padding: space.md,
  },
  safetyPlanHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space.sm,
  },
  safetyPlanIcon: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: radius.sm,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  safetyPlanCopy: {
    flex: 1,
  },
  safetyPlanEyebrow: {
    color: palette.sage,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  safetyPlanTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
    marginTop: 2,
  },
  safetyPlanBody: {
    color: palette.inkSoft,
    fontSize: 14,
    lineHeight: 20,
    marginTop: space.sm,
  },
  safetyChecks: {
    gap: space.xs,
    marginTop: space.md,
  },
  safetyCheck: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space.xs,
  },
  safetyCheckText: {
    color: palette.sage,
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  safetyPlanActions: {
    gap: space.xs,
    marginTop: space.lg,
  },
  shareButton: {
    alignItems: 'center',
    backgroundColor: palette.sage,
    borderRadius: radius.sm,
    flexDirection: 'row',
    gap: space.xs,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: space.md,
  },
  shareButtonText: {
    color: palette.white,
    fontSize: 14,
    fontWeight: '800',
  },
  mapButton: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: space.xs,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: space.md,
  },
  mapButtonText: {
    color: palette.brand,
    fontSize: 14,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.76,
  },
  inlineError: {
    backgroundColor: palette.dangerSoft,
    borderRadius: radius.sm,
    color: palette.danger,
    fontSize: 14,
    marginTop: 20,
    padding: 14,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: palette.brand,
    borderRadius: radius.sm,
    height: 56,
    justifyContent: 'center',
    marginTop: 24,
    paddingHorizontal: 28,
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
    flexDirection: 'row',
    gap: 9,
    height: 54,
    justifyContent: 'center',
    marginTop: 12,
  },
  secondaryText: {
    color: palette.ink,
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
