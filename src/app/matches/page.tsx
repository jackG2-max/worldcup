import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MatchCard } from "@/components/MatchCard";
import type { Match, MatchWithPrediction, Prediction } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "Matches · Grey World Cup Predictions" };

export default async function MatchesPage() {
  const auth = await requireAuth();
  const supabase = await createClient();

  const [{ data: matchRows }, { data: predictionRows }] = await Promise.all([
    supabase.from("matches").select("*").order("kickoff_at", { ascending: true }),
    supabase.from("predictions").select("*").eq("user_id", auth.userId),
  ]);

  const matches = (matchRows ?? []) as Match[];
  const predictions = (predictionRows ?? []) as Prediction[];
  const predByMatch = new Map(predictions.map((p) => [p.match_id, p]));

  const enriched: MatchWithPrediction[] = matches.map((m) => ({
    ...m,
    prediction: predByMatch.get(m.id) ?? null,
  }));

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Matches</h1>
        <p className="mt-1 text-sm text-gray-500">
          Predict the final score before kickoff. Predictions lock automatically.
        </p>
      </div>

      {enriched.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {enriched.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
      <p className="text-gray-600">No matches yet.</p>
      <p className="mt-1 text-sm text-gray-400">
        An admin needs to run <span className="font-medium">Sync fixtures</span> from
        the admin dashboard.
      </p>
    </div>
  );
}
