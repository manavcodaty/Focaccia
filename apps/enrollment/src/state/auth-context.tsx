import type { Session, User } from '@supabase/supabase-js';
import {
  AppState,
  type AppStateStatus,
} from 'react-native';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { enrollmentApi } from '../lib/api';
import {
  validateAuthCredentials,
  type AuthMode,
} from '../lib/auth-validation';
import { restoreEnrollmentSession } from '../lib/auth-session';
import { passVault } from '../lib/enrollment-storage';
import { supabase, supabaseAuthStorage } from '../lib/supabase';

interface AuthInput {
  email: string;
  fullName?: string;
  mode: AuthMode;
  password: string;
}

interface AuthContextValue {
  error: string | null;
  isLoading: boolean;
  session: Session | null;
  signInOrUp(input: AuthInput): Promise<void>;
  signOut(options?: { clearLocalData?: boolean }): Promise<void>;
  user: User | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function authMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Authentication failed.';
  if (/invalid login credentials/i.test(message)) {
    return 'The email or password is incorrect.';
  }
  if (/already registered/i.test(message)) {
    return 'An account already exists for this email. Sign in instead.';
  }
  if (/network|fetch|timeout|reach/i.test(message)) {
    return 'The authentication service is unreachable. Check the selected network mode and try again.';
  }
  return message;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void restoreEnrollmentSession(supabase.auth, supabaseAuthStorage)
      .then(({ error: sessionError, session: restoredSession }) => {
        if (!mounted) return;
        setSession(restoredSession);
        setError(sessionError ? authMessage(sessionError) : null);
        setIsLoading(false);
      })
      .catch((sessionError: unknown) => {
        if (!mounted) return;
        setSession(null);
        setError(authMessage(sessionError));
        setIsLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) setSession(nextSession);
    });

    const appStateListener = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
      appStateListener.remove();
    };
  }, []);

  const signInOrUp = useCallback(async (input: AuthInput) => {
    setError(null);
    setIsLoading(true);
    try {
      const credentials = validateAuthCredentials(input);
      if (credentials.mode === 'sign-in') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: credentials.email,
          password: credentials.password,
        });
        if (signInError) throw signInError;
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: credentials.email,
        options: { data: { full_name: credentials.fullName } },
        password: credentials.password,
      });
      if (signUpError) throw signUpError;
      if (!data.session) {
        throw new Error('Account creation succeeded but no session was returned. Email confirmation must remain disabled for this deployment.');
      }
      await enrollmentApi.ensureAttendee(credentials.fullName!);
    } catch (authError) {
      const message = authMessage(authError);
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(async ({ clearLocalData = false } = {}) => {
    setError(null);
    setIsLoading(true);
    try {
      const userId = session?.user.id;
      if (clearLocalData && userId) {
        await passVault.clearUser(userId);
      }
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
      if (signOutError) throw signOutError;
      setSession(null);
    } catch (authError) {
      const message = authMessage(authError);
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, [session?.user.id]);

  const value = useMemo<AuthContextValue>(() => ({
    error,
    isLoading,
    session,
    signInOrUp,
    signOut,
    user: session?.user ?? null,
  }), [error, isLoading, session, signInOrUp, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
