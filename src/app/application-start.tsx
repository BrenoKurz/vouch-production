import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/providers/auth-provider';
import { useMemberAccess } from '@/providers/member-access-provider';

export default function ApplicationStartScreen() {
  const { signOut } = useAuth();
  const { refresh } = useMemberAccess();

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.wordmark}>VOUCH</Text>
        <Text style={styles.title}>Your application starts here.</Text>
        <Text style={styles.body}>
          We could not find an application connected to this account.
          The mobile application form will be added in the next step.
        </Text>

        <Pressable onPress={refresh} style={styles.primaryButton}>
          <Text style={styles.primaryText}>Check again</Text>
        </Pressable>

        <Pressable onPress={signOut} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7F4EF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 28,
  },
  wordmark: {
    color: '#6E665F',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 4,
  },
  title: {
    color: '#171717',
    fontSize: 36,
    fontWeight: '600',
    letterSpacing: -1,
    lineHeight: 42,
    marginTop: 24,
  },
  body: {
    color: '#68635D',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 16,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#352D28',
    borderRadius: 10,
    height: 56,
    justifyContent: 'center',
    marginTop: 36,
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
    height: 54,
    justifyContent: 'center',
    marginTop: 12,
  },
  secondaryText: {
    color: '#352D28',
    fontSize: 16,
    fontWeight: '700',
  },
});
