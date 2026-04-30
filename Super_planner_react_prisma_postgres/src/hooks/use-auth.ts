import { useEffect, useState } from "react";
import {
  getSession,
  subscribeToSession,
  type AppSession,
  type AppUser,
} from "@/lib/auth-client";

export function useAuth() {
  const [session, setSession] = useState<AppSession | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSession()
      .then((nextSession) => {
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        setLoading(false);
      })
      .catch(() => {
        setSession(null);
        setUser(null);
        setLoading(false);
      });

    const unsubscribe = subscribeToSession((newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return { session, user, loading };
}
