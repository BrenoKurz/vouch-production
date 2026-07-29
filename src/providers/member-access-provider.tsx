import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { ApiError, apiGet } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import type {
  Application,
  ApplicationEnvelope,
} from '@/types/application';

export type { ApplicationStatus } from '@/types/application';

export type MemberAccessState =
  | { kind: 'loading' }
  | { kind: 'no_application' }
  | {
      kind: 'application';
      application: Application;
      version: number;
      contractVersion: string;
    }
  | {
      kind: 'error';
      message: string;
      retryable: boolean;
    };

type MemberAccessContextValue = {
  state: MemberAccessState;
  refresh: () => Promise<void>;
};

const MemberAccessContext =
  createContext<MemberAccessContextValue | null>(null);

export function MemberAccessProvider({
  children,
}: PropsWithChildren) {
  const { session, signOut } = useAuth();
  const accessToken = session?.access_token;
  const [state, setState] = useState<MemberAccessState>({
    kind: 'loading',
  });

  const refresh = useCallback(async () => {
    if (!accessToken) {
      setState({ kind: 'loading' });
      return;
    }

    setState({ kind: 'loading' });

    try {
      const response = await apiGet<ApplicationEnvelope>(
        '/applications/me',
        accessToken,
      );

      setState({
        kind: 'application',
        application: response.data,
        version: response.meta.version,
        contractVersion: response.meta.contract_version,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 404 || error.code === 'not_found') {
          setState({ kind: 'no_application' });
          return;
        }

        if (
          error.status === 401 ||
          error.code === 'authentication_required'
        ) {
          await signOut();
          return;
        }

        setState({
          kind: 'error',
          message: error.message,
          retryable: error.retryable || error.status === 0,
        });
        return;
      }

      setState({
        kind: 'error',
        message: 'Unable to determine your Vouch access.',
        retryable: true,
      });
    }
  }, [accessToken, signOut]);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (!cancelled) {
        void refresh();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const value = useMemo(
    () => ({ state, refresh }),
    [state, refresh],
  );

  return (
    <MemberAccessContext.Provider value={value}>
      {children}
    </MemberAccessContext.Provider>
  );
}

export function useMemberAccess() {
  const value = useContext(MemberAccessContext);

  if (!value) {
    throw new Error(
      'useMemberAccess must be used inside MemberAccessProvider.',
    );
  }

  return value;
}
