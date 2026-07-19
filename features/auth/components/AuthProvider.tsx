"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/profile";
import type { AuthContextValue } from "@/features/auth/types";

export const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const configured = isSupabaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(configured);
  const [profileLoading, setProfileLoading] = useState(false);

  const loadProfile = useCallback(
    async (userId: string) => {
      if (!configured) {
        setProfile(null);
        return;
      }

      setProfileLoading(true);

      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      setProfile((data as Profile | null) ?? null);
      setProfileLoading(false);
    },
    [configured],
  );

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }

    await loadProfile(user.id);
  }, [loadProfile, user]);

  useEffect(() => {
    if (!configured) {
      return;
    }

    const supabase = createClient();

    void supabase.auth.getUser().then(async ({ data }) => {
      const currentUser = data.user;

      setUser(currentUser);

      if (currentUser) {
        await loadProfile(currentUser.id);
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;

      setUser(currentUser);

      if (currentUser) {
        void loadProfile(currentUser.id);
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [configured, loadProfile]);

  const signOut = useCallback(async () => {
    if (!configured) return;

    const supabase = createClient();
    await supabase.auth.signOut();

    setUser(null);
    setProfile(null);
  }, [configured]);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured,
      loading,
      user,
      profile,
      profileLoading,
      refreshProfile,
      signOut,
    }),
    [
      configured,
      loading,
      user,
      profile,
      profileLoading,
      refreshProfile,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
