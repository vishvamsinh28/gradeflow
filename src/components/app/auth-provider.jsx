"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { currentUser, signOut as endSession } from "@/lib/auth";
const AuthContext = createContext({
  user: null,
  status: "loading",
  setUser: () => {},
  signOut: async () => {},
});
export function useAuth() {
  return useContext(AuthContext);
}
export function AuthProvider({ children }) {
  const router = useRouter();
  const [user, setUserState] = useState(null);
  const [status, setStatus] = useState("loading");
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
  const setUser = useCallback((next) => {
    setUserState(next);
    setStatus("authenticated");
  }, []);
  const signOut = useCallback(async () => {
    await endSession();
    setUserState(null);
    setStatus("anonymous");
    router.push("/");
  }, [router]);
  const value = useMemo(
    () => ({
      user,
      status,
      setUser,
      signOut,
    }),
    [user, status, setUser, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
