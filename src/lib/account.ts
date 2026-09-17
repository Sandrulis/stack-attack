import type { User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "./supabase";

export type PlayerStats = {
  bestScore: number;
  totalPlays: number;
  todayPlays: number;
  globalBest: number;
  displayName: string;
  nameSet: boolean;
  country: string;
  lives: number;
  nextLifeAt: number;
};

export type BoardRow = {
  userId: string;
  name: string;
  score: number;
  plays: number;
  country: string;
};

export const NAME_MIN = 2;
export const NAME_MAX = 24;

type RpcStats = {
  best_score?: number;
  total_plays?: number;
  today_plays?: number;
  global_best?: number;
  display_name?: string;
  name_set?: boolean;
  country?: string;
  lives?: number;
  next_life_at?: string | null;
};

type RpcBoardRow = {
  user_id?: string;
  display_name?: string;
  best_score?: number;
  total_plays?: number;
  country?: string;
};

function asInt(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asTime(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Date) {
    const n = value.getTime();
    return Number.isFinite(n) ? n : 0;
  }
  const n = Date.parse(String(value));
  return Number.isFinite(n) ? n : 0;
}

function readStats(raw: unknown): PlayerStats {
  const data = (raw ?? {}) as RpcStats;
  return {
    bestScore: asInt(data.best_score),
    totalPlays: asInt(data.total_plays),
    todayPlays: asInt(data.today_plays),
    globalBest: asInt(data.global_best),
    displayName: String(data.display_name || "Player"),
    nameSet: Boolean(data.name_set),
    country: String(data.country || "").trim(),
    lives: asInt(data.lives, 1),
    nextLifeAt: asTime(data.next_life_at),
  };
}

export function normalizePlayerName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, NAME_MAX);
}

export function isValidPlayerName(name: string): boolean {
  return name.length >= NAME_MIN && name.length <= NAME_MAX;
}

export function suggestedNameFromUser(user: User): string {
  const email = user.email ?? "";
  const at = email.indexOf("@");
  const local = (at >= 0 ? email.slice(0, at) : email).trim();
  return normalizePlayerName(local) || "Player";
}

export function playerAvatarFromUser(user: User): string {
  const meta = user.user_metadata ?? {};
  return String(meta.avatar_url || meta.picture || "");
}

function todayLocalIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function signInWithGoogle(): Promise<{ error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { error: "Supabase is not configured." };
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) return { error: error.message };
  return {};
}

export async function signOut(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function currentUser(): Promise<User | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
}

export function onAuthChange(handler: (user: User | null) => void): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => undefined;
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    handler(session?.user ?? null);
  });
  return () => data.subscription.unsubscribe();
}

export async function loadPlayerStats(user: User): Promise<PlayerStats | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("ensure_player", {
    p_name: suggestedNameFromUser(user),
    p_avatar: playerAvatarFromUser(user),
    p_day: todayLocalIso(),
  });
  if (error) throw error;
  return readStats(data);
}

export async function setPlayerName(name: string): Promise<PlayerStats | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("set_player_name", {
    p_name: normalizePlayerName(name),
    p_day: todayLocalIso(),
  });
  if (error) throw error;
  return readStats(data);
}

export async function startPlayerRun(user: User): Promise<PlayerStats | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("start_player_run", {
    p_name: suggestedNameFromUser(user),
    p_avatar: playerAvatarFromUser(user),
    p_day: todayLocalIso(),
  });
  if (error) throw error;
  return readStats(data);
}

export async function finishPlayerRun(score: number): Promise<PlayerStats | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("finish_player_run", {
    p_score: score,
    p_day: todayLocalIso(),
  });
  if (error) throw error;
  return readStats(data);
}

export async function spendPlayerLife(): Promise<PlayerStats | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("spend_player_life");
  if (error) throw error;
  return readStats(data);
}

export async function loadLeaderboard(country = ""): Promise<BoardRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("player_leaderboard", {
    p_country: country.trim() || null,
  });
  if (error) throw error;
  const parsed = typeof data === "string" ? JSON.parse(data) : data;
  const rows = Array.isArray(parsed) ? parsed : [];
  return (rows as RpcBoardRow[]).map((row) => ({
    userId: String(row.user_id ?? ""),
    name: String(row.display_name || "Player"),
    score: asInt(row.best_score),
    plays: asInt(row.total_plays),
    country: String(row.country || "").trim(),
  }));
}

export async function recordPlayerGeo(): Promise<string> {
  const supabase = getSupabase();
  const geo = await lookupClientGeo();
  if (!geo) return "";
  if (supabase) {
    const { error } = await supabase.rpc("set_player_geo", {
      p_ip: geo.ip,
      p_country: geo.country,
      p_country_code: geo.countryCode,
    });
    if (error) throw error;
  }
  return geo.country;
}

export async function detectViewerCountry(): Promise<string> {
  const geo = await lookupClientGeo();
  return geo?.country ?? "";
}

async function lookupClientGeo(): Promise<{ ip: string; country: string; countryCode: string } | null> {
  try {
    const res = await fetch("https://ipwho.is/", { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      success?: boolean;
      ip?: string;
      country?: string;
      country_code?: string;
    };
    if (data.success === false) return null;
    const ip = String(data.ip || "").trim();
    const country = String(data.country || "").trim();
    const countryCode = String(data.country_code || "").trim();
    if (!ip && !country) return null;
    return { ip, country, countryCode };
  } catch {
    return null;
  }
}

export { isSupabaseConfigured };
