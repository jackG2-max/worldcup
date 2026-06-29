"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface PredictionActionState {
  ok: boolean;
  error?: string;
  message?: string;
}

/**
 * Upsert the current user's prediction for a match.
 *
 * Defense in depth: we check kickoff here for a friendly message, but the RLS
 * policies on `predictions` also enforce ownership + the kickoff lock, so a
 * locked prediction can never be written even if this check were bypassed.
 */
export async function submitPrediction(
  _prev: PredictionActionState,
  formData: FormData,
): Promise<PredictionActionState> {
  const matchId = String(formData.get("match_id") ?? "");
  const home = Number(formData.get("home"));
  const away = Number(formData.get("away"));

  if (!matchId) return { ok: false, error: "Missing match." };
  if (
    !Number.isInteger(home) ||
    !Number.isInteger(away) ||
    home < 0 ||
    away < 0 ||
    home > 99 ||
    away > 99
  ) {
    return { ok: false, error: "Enter whole numbers between 0 and 99." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You are not signed in." };

  const { data: match } = await supabase
    .from("matches")
    .select("kickoff_at")
    .eq("id", matchId)
    .single();

  if (!match) return { ok: false, error: "Match not found." };
  if (!match.kickoff_at || new Date(match.kickoff_at) <= new Date()) {
    return { ok: false, error: "Predictions are locked for this match." };
  }

  const { error } = await supabase.from("predictions").upsert(
    {
      user_id: user.id,
      match_id: matchId,
      predicted_home_score: home,
      predicted_away_score: away,
    },
    { onConflict: "user_id,match_id" },
  );

  if (error) return { ok: false, error: error.message };

  revalidatePath("/matches");
  revalidatePath("/predictions");
  return { ok: true, message: "Prediction saved." };
}
