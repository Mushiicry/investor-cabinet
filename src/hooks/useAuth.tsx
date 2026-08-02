/* eslint-disable react-refresh/only-export-components -- хук/хелперы намеренно рядом с компонентом (личный инструмент) */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { clearCachedInvestorState } from "../services/investorDataCache";

type AuthResult = { error: string | null };

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  user: User | null;
  accessToken: string | null;
  displayName: string;
  signUp: (name: string, email: string, password: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function nameFromUser(user: User | null): string {
  if (!user) return "";
  const meta = user.user_metadata as { name?: string; full_name?: string } | undefined;
  return meta?.name || meta?.full_name || user.email?.split("@")[0] || "";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  // Если Supabase не сконфигурирован — грузиться нечему, сразу готово.
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) return;

    let mounted = true;

    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      if (!mounted) return;
      setUser(data.session?.user ?? null);
      setAccessToken(data.session?.access_token ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAccessToken(session?.access_token ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    configured: isSupabaseConfigured,
    loading,
    user,
    accessToken,
    displayName: nameFromUser(user),
    async signUp(name, email, password) {
      if (!supabase) return { error: "Авторизация не настроена" };
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { name: name.trim() } },
      });
      return { error: error?.message ?? null };
    },
    async signIn(email, password) {
      if (!supabase) return { error: "Авторизация не настроена" };
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      return { error: error?.message ?? null };
    },
    async signOut() {
      // Чистим кэш портфеля до выхода — чтобы на общем устройстве
      // финансовые данные не остались в localStorage.
      clearCachedInvestorState();
      if (!supabase) return;
      await supabase.auth.signOut();
    },
  }), [accessToken, loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
