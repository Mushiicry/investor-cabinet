import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Ключи публичные (anon) — их безопасно держать во фронтенде. Секретный
// service_role ключ здесь НЕ используется и не должен попадать в клиент.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Пока ключи не заданы — авторизация выключена, приложение работает как раньше
// (без гейта). Как только env-переменные появятся — авторизация активируется.
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

// Email владельца — под ним показываются реальные данные, под остальными нули.
export const FOUNDER_EMAIL = (
  (import.meta.env.VITE_FOUNDER_EMAIL as string | undefined) ?? ""
)
  .trim()
  .toLowerCase();

export function isFounderEmail(email: string | null | undefined): boolean {
  if (!email || !FOUNDER_EMAIL) return false;
  return email.trim().toLowerCase() === FOUNDER_EMAIL;
}
