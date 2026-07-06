'use client';

import type { Session, User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { ticketApi } from '@/lib/api';
import { clearFocacciaSessionArtifacts } from '@/lib/session-artifacts';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import type { AttendeeProfile } from '@/lib/types';

interface AuthContextValue {
  loading: boolean;
  profile: AttendeeProfile | null;
  session: Session | null;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  signUp(fullName: string, email: string, password: string): Promise<void>;
  user: User | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadProfile(session: Session): Promise<AttendeeProfile | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('attendee_profiles')
    .select('user_id, email, full_name')
    .eq('user_id', session.user.id)
    .maybeSingle();
  if (error) throw error;
  if (data) return data as AttendeeProfile;

  const fullName = typeof session.user.user_metadata.full_name === 'string'
    ? session.user.user_metadata.full_name.trim()
    : '';
  if (!fullName) return null;
  return ticketApi.ensureAttendee(session.access_token, fullName);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<AttendeeProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  const handleAuthLoadError = useCallback(() => {
    setProfile(null);
    setLoading(false);
  }, []);

  const applySession = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    if (!nextSession) {
      setProfile(null);
      setLoading(false);
      return;
    }
    try {
      setProfile(await loadProfile(nextSession));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    void supabase.auth.getSession()
      .then(({ data }) => applySession(data.session))
      .catch(handleAuthLoadError);
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void applySession(nextSession).catch(handleAuthLoadError);
    });
    return () => data.subscription.unsubscribe();
  }, [applySession, handleAuthLoadError]);

  const value = useMemo<AuthContextValue>(() => ({
    loading,
    profile,
    session,
    async signIn(email, password) {
      setLoading(true);
      const { data, error } = await getSupabaseBrowserClient().auth.signInWithPassword({ email, password });
      if (error) {
        setLoading(false);
        throw error;
      }
      await applySession(data.session);
    },
    async signOut() {
      const { error } = await getSupabaseBrowserClient().auth.signOut();
      if (error) throw error;
      if (typeof sessionStorage !== 'undefined') {
        clearFocacciaSessionArtifacts(sessionStorage);
      }
      await applySession(null);
    },
    async signUp(fullName, email, password) {
      setLoading(true);
      const { data, error } = await getSupabaseBrowserClient().auth.signUp({
        email,
        options: { data: { full_name: fullName.trim() } },
        password,
      });
      if (error) {
        setLoading(false);
        throw error;
      }
      if (!data.session) {
        setLoading(false);
        throw new Error('Account created, but no session was returned. Email confirmation must be disabled for this deployment.');
      }
      await ticketApi.ensureAttendee(data.session.access_token, fullName.trim());
      await applySession(data.session);
    },
    user: session?.user ?? null,
  }), [applySession, loading, profile, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
