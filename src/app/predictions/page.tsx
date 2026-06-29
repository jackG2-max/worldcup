import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMatchStateInfo } from "@/lib/match-state";
import type { Match, Prediction } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "My Predictions · Grey World Cup Predictions" };

type PredictionWithMatch = Prediction & { matches: Match | null };

export default async function MyPredictionsPage() {
  const auth = await requireAuth();
  const supabase = await createClient();

  const { data } = await supabase
    .from("predictions")
    .select("*, matches(*)")
    .eq("user_id", auth.userId);

  const rows = ((data ?? []) as PredictionWithMatch[])
    .filter((r) => r.matches)
    .sort((a, b) => {
      const ka = a.matches?.kickoff_at ?? "";
      const kb = b.matches?.kickoff_at ?? "";
      return ka < kb ? 1 : ka > kb ? -1 : 0; // most recent kickoff first
    });

  const totalPoints = rows
    .filter((r) => r.calculated)
    .reduce((sum, r) => sum + r.points, 0);

  return (
    <div>
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Predictions</h1>
          <p className="mt-1 text-sm text-gray-500">
            {rows.length} prediction{rows.length === 1 ? "" : "s"} · {totalPoints} points
            so far
          </p>
        </div>
        <Link href="/matches" className="text-sm font-medium text-brand-accent hover:underline">
          Make predictions →
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">
          You haven&apos;t made any predictions yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Match</th>
                <th className="px-4 py-3">Your pick</th>
                <th className="px-4 py-3">Result</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => {
                const m = r.matches!;
                const info = getMatchStateInfo(m);
                const hasResult = m.home_score !== null && m.away_score !== null;
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-medium">
                      {m.home_team} v {m.away_team}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {r.predicted_home_score} – {r.predicted_away_score}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-gray-600">
                      {hasResult ? `${m.home_score} – ${m.away_score}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${info.badgeClass}`}>
                        {info.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {r.calculated ? r.points : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
