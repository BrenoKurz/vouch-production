import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/providers/auth-provider';

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await signOut();
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.title}>Profile</Text>
        <View style={styles.card}>
          <Text style={styles.label}>SIGNED IN AS</Text>
          <Text style={styles.email}>{session?.user.email}</Text>
        </View>

        <Pressable
          disabled={isSigningOut}
          onPress={handleSignOut}
          style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}
        >
          {isSigningOut ? (
            <ActivityIndicator color="#352D28" />
          ) : (
            <Text style={styles.signOutText}>Sign out</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F4EF' },
  content: { flex: 1, padding: 24 },
  title: { color: '#171717', fontSize: 32, fontWeight: '700', marginTop: 20 },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E1DBD4',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 30,
    padding: 20,
  },
  label: {
    color: '#7C736B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  email: { color: '#171717', fontSize: 17, fontWeight: '600', marginTop: 10 },
  signOutButton: {
    alignItems: 'center',
    borderColor: '#BEB6AE',
    borderRadius: 10,
    borderWidth: 1,
    height: 54,
    justifyContent: 'center',
    marginTop: 24,
  },
  pressed: { opacity: 0.7 },
  signOutText: { color: '#352D28', fontSize: 16, fontWeight: '700' },
});
