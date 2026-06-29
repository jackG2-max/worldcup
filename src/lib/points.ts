import type { SupabaseClient } from "@supabase/supabase-js";
import { calculatePoints } from "./scoring";
import type { Match, Prediction } from "./types";

/**
 * (Re)calculate and persist points for every prediction on a single match.
 *
 * Idempotent: each prediction's `points` column is *overwritten* with the value
 * derived from the prediction + final score, so running this any number of
 * times yields the same result and never double-counts.
 *
 * The caller must pass a service-role client (RLS would otherwise block writing
 * `points`/`calculated` after kickoff).
 */
export async function calculateMatchPoints(
  admin: SupabaseClient,
  match: Pick<Match, "id" | "home_score" | "away_score">,
): Promise<number> {
  if (match.home_score === null || match.away_score === null) {
    return 0; // no final score yet — nothing to score
  }

  const { data, error } = await admin
    .from("predictions")
    .select("*")
    .eq("match_id", match.id);

  if (error) throw new Error(`Failed to load predictions: ${error.message}`);

  const predictions = (data ?? []) as Prediction[];
  if (predictions.length === 0) return 0;

  const nowIso = new Date().toISOString();
  const rows = predictions.map((p) => ({
    ...p,
    points: calculatePoints(
      p.predicted_home_score,
      p.predicted_away_score,
      match.home_score as number,
      match.away_score as number,
    ),
    calculated: true,
    updated_at: nowIso,
  }));

  const { error: upsertError } = await admin
    .from("predictions")
    .upsert(rows, { onConflict: "id" });

  if (upsertError) {
    throw new Error(`Failed to write points: ${upsertError.message}`);
  }

  return rows.length;
}
