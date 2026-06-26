import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, type Profile } from "../lib/supabase";
import { ensureProfile } from "../lib/ensureProfile";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load profile:", error.message);
    return null;
  }

  return data;
}

async function loadOrCreateProfile(userId: string): Promise<Profile | null> {
  let profile = await fetchProfile(userId);
  if (profile) return profile;

  const ensureError = await ensureProfile();
  if (ensureError) {
    console.error("Failed to ensure profile:", ensureError);
    return null;
  }

  return fetchProfile(userId);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      setSession(data.session);
      if (data.session?.user) {
        setProfile(await loadOrCreateProfile(data.session.user.id));
      }
      setLoading(false);
    }

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) {
        setProfile(await loadOrCreateProfile(nextSession.user.id));
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      const trimmedName = displayName.trim() || null;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: trimmedName },
        },
      });
      if (error) return error.message;

      // Save display name on profile when session is active immediately after signup.
      if (data.user && data.session) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ display_name: trimmedName })
          .eq("id", data.user.id);

        if (profileError) return profileError.message;
      }

      return null;
    },
    []
  );

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      setProfile(await loadOrCreateProfile(data.session.user.id));
    }
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      refreshProfile,
      signUp,
      signIn,
      signOut,
    }),
    [session, profile, loading, refreshProfile, signUp, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
