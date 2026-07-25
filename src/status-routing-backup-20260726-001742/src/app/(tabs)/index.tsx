import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/providers/auth-provider';

export default function HomeScreen() {
  const { session } = useAuth();
  const firstName =
    session?.user.user_metadata?.first_name ??
    session?.user.user_metadata?.display_name ??
    'there';

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>VOUCH</Text>
        <Text style={styles.title}>Welcome, {firstName}.</Text>
        <Text style={styles.subtitle}>
          Your private member experience is ready. We’ll build the live
          introduction and date flows next.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>NEXT STEP</Text>
          <Text style={styles.cardTitle}>Complete your member foundation</Text>
          <Text style={styles.cardBody}>
            We’ll connect your application status, profile, introductions, and
            upcoming dates to the live Vouch backend.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F4EF' },
  content: { flex: 1, padding: 24 },
  eyebrow: {
    color: '#6E665F',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 3,
    marginTop: 20,
  },
  title: {
    color: '#171717',
    fontSize: 34,
    fontWeight: '600',
    letterSpacing: -1,
    marginTop: 20,
  },
  subtitle: {
    color: '#68635D',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E1DBD4',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 36,
    padding: 22,
  },
  cardLabel: {
    color: '#7C736B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  cardTitle: {
    color: '#171717',
    fontSize: 21,
    fontWeight: '700',
    marginTop: 10,
  },
  cardBody: {
    color: '#68635D',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
});
