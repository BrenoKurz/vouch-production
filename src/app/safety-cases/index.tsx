import { Ionicons } from '@expo/vector-icons';
import {
  type Href,
  router,
  useFocusEffect,
} from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useCallback, useState } from 'react';

import { StackHeader } from '@/components/vouch-ui';
import { layout } from '@/constants/design';
import { ApiError, apiGet } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import type {
  MemberSafetyCase,
  SafetyCasesEnvelope,
  SafetyCaseState,
  SafetyCategory,
} from '@/types/safety';

const stateLabels: Record<SafetyCaseState, string> = {
  open: 'Received',
  assigned: 'Assigned',
  investigating: 'Under review',
  resolved: 'Resolved',
  dismissed: 'Closed',
};

const categoryLabels: Record<SafetyCategory, string> = {
  harassment: 'Harassment',
  coercion: 'Coercion or pressure',
  threats: 'Threats',
  physical_safety: 'Physical safety',
  sexual_misconduct: 'Sexual misconduct',
  fraud: 'Fraud or financial concern',
  impersonation: 'Impersonation',
  other: 'Other concern',
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export default function SafetyCasesScreen() {
  const { session, signOut } = useAuth();
  const accessToken = session?.access_token;
  const [items, setItems] = useState<MemberSafetyCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!accessToken) return;

      if (mode === 'initial') setIsLoading(true);
      if (mode === 'refresh') setIsRefreshing(true);
      setErrorMessage('');

      try {
        const response = await apiGet<SafetyCasesEnvelope>(
          '/safety-cases',
          accessToken,
        );
        setItems(response.data);
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
            : 'Unable to load your private reports.',
        );
      } finally {
        if (mode === 'initial') setIsLoading(false);
        if (mode === 'refresh') setIsRefreshing(false);
      }
    },
    [accessToken, signOut],
  );

  useFocusEffect(
    useCallback(() => {
      void load('initial');
    }, [load]),
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.screen}>
        <Header />
        <View style={styles.center}>
          <ActivityIndicator color="#352D28" size="large" />
          <Text style={styles.helper}>
            Loading your private reports…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Header />
      <FlatList
        contentContainerStyle={[
          styles.list,
          items.length === 0 && styles.emptyList,
        ]}
        data={items}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.intro}>
            <Text style={styles.eyebrow}>PRIVATE & PROTECTED</Text>
            <Text style={styles.title}>Safety reports</Text>
            <Text style={styles.helper}>
              Only you and authorized Vouch safety staff can access
              these reports.
            </Text>
            {errorMessage ? (
              <Text style={styles.inlineError}>{errorMessage}</Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons
                color="#766E67"
                name="shield-checkmark-outline"
                size={28}
              />
            </View>
            <Text style={styles.emptyTitle}>No safety reports</Text>
            <Text style={styles.emptyBody}>
              Private reports you submit will appear here.
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            onRefresh={() => void load('refresh')}
            refreshing={isRefreshing}
            tintColor="#352D28"
          />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push(
                {
                  pathname: '/safety-case/[id]',
                  params: { id: item.id },
                } as Href,
              )
            }
            style={styles.card}
          >
            <View
              style={[
                styles.cardIcon,
                item.priority === 'urgent' &&
                  styles.urgentCardIcon,
              ]}
            >
              <Ionicons
                color={
                  item.priority === 'urgent'
                    ? '#943D35'
                    : '#365C4D'
                }
                name={
                  item.priority === 'urgent'
                    ? 'warning-outline'
                    : 'shield-outline'
                }
                size={21}
              />
            </View>
            <View style={styles.cardCopy}>
              <Text style={styles.cardTitle}>
                {categoryLabels[item.category]}
              </Text>
              <Text style={styles.cardMeta}>
                {formatDate(item.created_at)} ·{' '}
                {stateLabels[item.state]}
              </Text>
              <Text numberOfLines={2} style={styles.cardBody}>
                {item.narrative}
              </Text>
            </View>
            <Ionicons
              color="#8A827A"
              name="chevron-forward"
              size={20}
            />
          </Pressable>
        )}
        showsVerticalScrollIndicator={false}
      />
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
  list: {
    alignSelf: 'center',
    maxWidth: layout.contentMaxWidth,
    paddingBottom: 40,
    paddingHorizontal: 20,
    width: '100%',
  },
  emptyList: { flexGrow: 1 },
  intro: { paddingBottom: 20, paddingTop: 12 },
  eyebrow: {
    color: '#766E67',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  title: {
    color: '#171717',
    fontSize: 31,
    fontWeight: '700',
    letterSpacing: -0.8,
    marginTop: 9,
  },
  helper: {
    color: '#68635D',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  inlineError: {
    backgroundColor: '#F6E9E6',
    borderRadius: 9,
    color: '#943D35',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 16,
    padding: 14,
  },
  card: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2DCD5',
    borderRadius: 11,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    padding: 14,
  },
  cardIcon: {
    alignItems: 'center',
    backgroundColor: '#E5ECE8',
    borderRadius: 9,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  urgentCardIcon: { backgroundColor: '#F6E9E6' },
  cardCopy: { flex: 1 },
  cardTitle: {
    color: '#2D2926',
    fontSize: 15,
    fontWeight: '800',
  },
  cardMeta: {
    color: '#746D66',
    fontSize: 12,
    marginTop: 4,
  },
  cardBody: {
    color: '#5E5751',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 80,
    paddingHorizontal: 34,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: '#EEEAE5',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  emptyTitle: {
    color: '#1F1D1B',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 16,
  },
  emptyBody: {
    color: '#6F6861',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    textAlign: 'center',
  },
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 28,
  },
});
