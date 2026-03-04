import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import {
    clearStoredSession,
    getStoredSession,
    saveStoredSession,
    type AuthSession,
} from '@/services/auth';

type AuthContextValue = {
  session: AuthSession | null;
  isHydrating: boolean;
  setAuthenticatedSession: (nextSession: AuthSession) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function hydrateSession() {
      try {
        const storedSession = await getStoredSession();

        if (!isMounted) {
          return;
        }

        if (storedSession) {
          setSession(storedSession);
        }
      } finally {
        if (isMounted) {
          setIsHydrating(false);
        }
      }
    }

    void hydrateSession();

    return () => {
      isMounted = false;
    };
  }, []);

  async function setAuthenticatedSession(nextSession: AuthSession) {
    await saveStoredSession(nextSession);
    setSession(nextSession);
  }

  async function signOut() {
    await clearStoredSession();
    setSession(null);
  }

  const value = useMemo(
    () => ({
      session,
      isHydrating,
      setAuthenticatedSession,
      signOut,
    }),
    [session, isHydrating]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
