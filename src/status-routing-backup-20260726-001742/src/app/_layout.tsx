import { Stack, SplashScreen } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from '@/providers/auth-provider';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  if (isLoading) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>

        <Stack.Protected guard={Boolean(session)}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
