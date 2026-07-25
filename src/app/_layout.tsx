import { Stack, SplashScreen } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from '@/providers/auth-provider';
import {
  MemberAccessProvider,
  useMemberAccess,
} from '@/providers/member-access-provider';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, isLoading: isAuthLoading } = useAuth();
  const { state } = useMemberAccess();

  const isAccessLoading = Boolean(session) && state.kind === 'loading';
  const hasNoApplication =
    Boolean(session) && state.kind === 'no_application';
  const hasInvitedAccess =
    Boolean(session) &&
    state.kind === 'application' &&
    state.application.status === 'invited';
  const hasStatusScreen =
    Boolean(session) &&
    (state.kind === 'error' ||
      (state.kind === 'application' &&
        state.application.status !== 'invited'));

  useEffect(() => {
    if (!isAuthLoading) {
      SplashScreen.hideAsync();
    }
  }, [isAuthLoading]);

  if (isAuthLoading) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>

        <Stack.Protected guard={isAccessLoading}>
          <Stack.Screen name="bootstrap" />
        </Stack.Protected>

        <Stack.Protected guard={hasNoApplication}>
          <Stack.Screen name="application-start" />
        </Stack.Protected>

        <Stack.Protected guard={hasStatusScreen}>
          <Stack.Screen name="application-status" />
        </Stack.Protected>

        <Stack.Protected guard={hasInvitedAccess}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

function AppProviders() {
  return (
    <MemberAccessProvider>
      <RootNavigator />
    </MemberAccessProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AppProviders />
    </AuthProvider>
  );
}
