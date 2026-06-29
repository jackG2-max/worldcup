import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export interface AuthContext {
  userId: string;
  email: string | null;
  profile: Profile | null;
}

/** Returns the current user + profile, or null when not signed in. */
export async function getAuth(): Promise<AuthContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return {
    userId: user.id,
    email: user.email ?? null,
    profile: (profile as Profile) ?? null,
  };
}

/** Like getAuth() but redirects to /login when not signed in. */
export async function requireAuth(): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  return auth;
}

export function isAdmin(auth: AuthContext | null): boolean {
  return auth?.profile?.role === "admin";
}

/** Redirects non-admins to /matches; returns the admin context otherwise. */
export async function requireAdmin(): Promise<AuthContext> {
  const auth = await requireAuth();
  if (!isAdmin(auth)) redirect("/matches");
  return auth;
}

/**
 * For Route Handlers: returns the admin context or null (so the caller can
 * respond with 401/403 rather than redirecting).
 */
export async function getAdminOrNull(): Promise<AuthContext | null> {
  const auth = await getAuth();
  return isAdmin(auth) ? auth : null;
}
