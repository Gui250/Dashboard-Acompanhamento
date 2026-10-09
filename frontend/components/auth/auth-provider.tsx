"use client";

import { createContext, useContext, useLayoutEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, type AuthSession, type User } from "@/lib/api";
import { clearStoredSession, getStoredToken, getStoredUser, storeSession, storeUser } from "@/lib/auth-storage";

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  startSession: (session: AuthSession) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useLayoutEffect(() => {
    const token = getStoredToken();
    const stored = token ? getStoredUser() : null;
    if (!token) {
      setIsLoading(false);
      return;
    }
    if (stored) {
      setUser(stored);
      setIsLoading(false);
    }

    let active = true;
    getCurrentUser()
      .then((currentUser) => {
        if (!active) return;
        setUser(currentUser);
        storeUser(currentUser);
      })
      .catch(() => {
        if (!active) return;
        clearStoredSession();
        setUser(null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => { active = false; };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isLoading,
    startSession: (session) => {
      storeSession(session);
      setUser(session.user);
    },
    signOut: () => {
      clearStoredSession();
      setUser(null);
      router.replace("/login");
    },
  }), [isLoading, router, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
