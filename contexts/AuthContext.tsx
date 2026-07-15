import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { UserRole } from '../lib/database.types';
import { registerPushToken, setupAndroidChannel } from '../lib/notifications';
import { saveAccount } from '../lib/account';

// ── Types ─────────────────────────────────────────────────────

export type AccountType = 'private' | 'business';

type AuthState = {
  user: User | null;
  role: UserRole | null;
  accountType: AccountType | null;
  loading: boolean;
};

// ── Context ───────────────────────────────────────────────────

const AuthContext = createContext<AuthState>({ user: null, role: null, accountType: null, loading: true });

// ── Provider ──────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let mounted = true;

    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        setUser(session?.user ?? null);
        if (session?.user) {
          const p = await fetchProfileWithTimeout(session.user.id);
          if (mounted) { setRole(p.role); setAccountType(p.accountType); }
        }
      } finally {
        // loading darf NIE haengen bleiben — die Root-Weiche (tabs)/index
        // wartet darauf; ein haengender Profil-Fetch fror sonst den
        // Kaltstart ein (Befund 15.07., gleiches Muster wie Login-Fix #33).
        if (mounted) setLoading(false);
      }
    }

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        setUser(session?.user ?? null);
        if (session?.user) {
          const p = await fetchProfileWithTimeout(session.user.id);
          if (mounted) { setRole(p.role); setAccountType(p.accountType); }
          // Register push token on sign-in (silently — user already granted permission in onboarding)
          setupAndroidChannel();
          registerPushToken(session.user.id);
        } else {
          setRole(null);
          setAccountType(null);
        }
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, accountType, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

// ── Internal helper ───────────────────────────────────────────

function fetchProfileWithTimeout(userId: string): Promise<{ role: UserRole | null; accountType: AccountType | null }> {
  return Promise.race([
    fetchProfile(userId),
    new Promise<{ role: null; accountType: null }>((resolve) =>
      setTimeout(() => resolve({ role: null, accountType: null }), 4000)),
  ]);
}

async function fetchProfile(userId: string): Promise<{ role: UserRole | null; accountType: AccountType | null }> {
  const { data } = await supabase
    .from('profiles')
    .select('role, account_type')
    .eq('id', userId)
    .maybeSingle<{ role: UserRole; account_type: AccountType }>();
  const accountType = data?.account_type ?? 'private';
  // Sync B2B flag to AsyncStorage so rechnung.tsx invoice logic works offline.
  saveAccount({ isBusinessUser: accountType === 'business', userId }).catch(() => {});
  return { role: data?.role ?? null, accountType };
}
