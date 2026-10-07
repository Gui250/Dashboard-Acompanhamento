"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
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

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    setUser(getStoredUser());
    getCurrentUser()
      .then((currentUser) => {
        setUser(currentUser);
        storeUser(currentUser);
      })
      .catch(() => {
        clearStoredSession();
        setUser(null);
      })
      .finally(() => setIsLoading(false));
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
