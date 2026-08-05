import { Stack, SplashScreen } from "expo-router";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";

import { AuthProvider, useAuth } from "@/providers/auth-provider";
import {
  MemberAccessProvider,
  useMemberAccess,
} from "@/providers/member-access-provider";
import { NotificationProvider } from "@/providers/notification-provider";

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, isLoading: isAuthLoading } = useAuth();
  const { state } = useMemberAccess();

  const isAccessLoading = Boolean(session) && state.kind === "loading";
  const hasNoApplication = Boolean(session) && state.kind === "no_application";
  const hasInvitedAccess =
    Boolean(session) &&
    state.kind === "application" &&
    state.application.status === "invited";
  const hasStatusScreen =
    Boolean(session) &&
    (state.kind === "error" ||
      (state.kind === "application" && state.application.status !== "invited"));

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
        <Stack.Screen name="auth/callback" />

        <Stack.Protected guard={!session}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>

        <Stack.Protected guard={Boolean(session)}>
          <Stack.Screen name="reset-password" />
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
          <Stack.Screen name="verification" />
          <Stack.Screen name="intake" />
          <Stack.Screen name="voice-intake" />
          <Stack.Screen name="edit-profile" />
          <Stack.Screen name="profile-photos" />
          <Stack.Screen name="ai-matchmaker" />
          <Stack.Screen name="account" />
          <Stack.Screen name="privacy-requests" />
          <Stack.Screen name="trust-center" />
          <Stack.Screen name="introduction/[id]" />
          <Stack.Screen name="conversation/[id]" />
          <Stack.Screen name="schedule-date/[conversationId]" />
          <Stack.Screen name="date/[id]" />
          <Stack.Screen name="debrief/[id]" />
          <Stack.Screen name="cancel-date/[id]" />
          <Stack.Screen name="reschedule-date/[id]" />
          <Stack.Screen name="report-safety/[conversationId]" />
          <Stack.Screen name="safety-case/[id]" />
          <Stack.Screen name="safety-cases/index" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

function AppProviders() {
  return (
    <MemberAccessProvider>
      <NotificationProvider>
        <RootNavigator />
      </NotificationProvider>
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
