import {
  AppState,
  Platform,
  type AppStateStatus,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { ApiError, apiGet } from '@/lib/api';
import { registerForPushNotifications } from '@/lib/push-notifications';
import { useAuth } from '@/providers/auth-provider';
import type { NotificationUnreadCountEnvelope } from '@/types/notification';

type NotificationContextValue = {
  unreadCount: number;
  isLoading: boolean;
  refreshUnreadCount: () => Promise<void>;
  decrementUnreadCount: () => void;
  clearUnreadCount: () => void;
};

const NotificationContext =
  createContext<NotificationContextValue | null>(null);

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export function NotificationProvider({
  children,
}: PropsWithChildren) {
  const { session, signOut } = useAuth();
  const accessToken = session?.access_token;
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const pushEnabled =
    session?.user.user_metadata?.vouch_communication_preferences?.push === true;

  const refreshPushRegistration = useCallback(async () => {
    if (!accessToken || !pushEnabled) return;

    try {
      await registerForPushNotifications(accessToken, {
        requestPermission: false,
      });
    } catch (error) {
      console.warn(
        'Unable to refresh native push registration:',
        error instanceof Error ? error.message : error,
      );
    }
  }, [accessToken, pushEnabled]);

  const refreshUnreadCount = useCallback(async () => {
    if (!accessToken) {
      setUnreadCount(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const response =
        await apiGet<NotificationUnreadCountEnvelope>(
          '/notifications/unread-count',
          accessToken,
        );

      setUnreadCount(
        Math.max(0, response.data.unread_count),
      );
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.status === 401 ||
          error.code === 'authentication_required')
      ) {
        setUnreadCount(0);
        await signOut();
      }
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, signOut]);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (!cancelled) {
        void refreshUnreadCount();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [refreshUnreadCount]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener(() => {
        router.push('/(tabs)/notifications');
        void refreshUnreadCount();
      });

    return () => responseSubscription.remove();
  }, [refreshUnreadCount]);

  useEffect(() => {
    void refreshPushRegistration();
  }, [refreshPushRegistration]);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState) => {
        const wasInactive =
          appState.current === 'background' ||
          appState.current === 'inactive';

        appState.current = nextState;

        if (wasInactive && nextState === 'active') {
          void refreshUnreadCount();
          void refreshPushRegistration();
        }
      },
    );

    return () => subscription.remove();
  }, [refreshPushRegistration, refreshUnreadCount]);

  const value = useMemo<NotificationContextValue>(
    () => ({
      unreadCount,
      isLoading,
      refreshUnreadCount,
      decrementUnreadCount: () => {
        setUnreadCount((current) =>
          Math.max(0, current - 1),
        );
      },
      clearUnreadCount: () => setUnreadCount(0),
    }),
    [isLoading, refreshUnreadCount, unreadCount],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const value = useContext(NotificationContext);

  if (!value) {
    throw new Error(
      'useNotifications must be used inside NotificationProvider.',
    );
  }

  return value;
}
