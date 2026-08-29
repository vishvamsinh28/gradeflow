"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { currentUser, signOut as endSession, type User } from "@/lib/auth";

type AuthState = {
  user: User | null;
  status: "loading" | "authenticated" | "anonymous";
  setUser: (user: User) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  user: null,
  status: "loading",
  setUser: () => {},
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUserState] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthState["status"]>("loading");

  useEffect(() => {
    let alive = true;
    currentUser().then((found) => {
      if (!alive) return;
      setUserState(found);
      setStatus(found ? "authenticated" : "anonymous");
    });
    return () => {
      alive = false;
    };
  }, []);

  const setUser = useCallback((next: User) => {
    setUserState(next);
    setStatus("authenticated");
  }, []);

  const signOut = useCallback(async () => {
    await endSession();
    setUserState(null);
    setStatus("anonymous");
    router.push("/");
  }, [router]);

  const value = useMemo<AuthState>(
    () => ({ user, status, setUser, signOut }),
    [user, status, setUser, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
