import {
  AppState,
  type AppStateStatus,
} from 'react-native';
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

export function NotificationProvider({
  children,
}: PropsWithChildren) {
  const { session, signOut } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const refreshUnreadCount = useCallback(async () => {
    const accessToken = session?.access_token;

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
  }, [session?.access_token, signOut]);

  useEffect(() => {
    void refreshUnreadCount();
  }, [refreshUnreadCount]);

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
        }
      },
    );

    return () => subscription.remove();
  }, [refreshUnreadCount]);

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
