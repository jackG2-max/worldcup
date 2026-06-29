import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { LeaderboardRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "Leaderboard · Grey World Cup Predictions" };

export default async function LeaderboardPage() {
  const auth = await requireAuth();
  const supabase = await createClient();

  const { data } = await supabase
    .from("leaderboard_view")
    .select("*")
    .order("total_points", { ascending: false })
    .order("exact_scores_count", { ascending: false });

  const rows = (data ?? []) as LeaderboardRow[];

  // Standard competition ranking (1224): tied users share a rank.
  let lastPoints: number | null = null;
  let lastRank = 0;
  const ranked = rows.map((row, i) => {
    if (lastPoints === null || row.total_points !== lastPoints) {
      lastRank = i + 1;
      lastPoints = row.total_points;
    }
    return { ...row, rank: lastRank };
  });

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Leaderboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Only approved results count toward points.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Player</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3 text-right">Points</th>
              <th className="px-4 py-3 text-right">Exact</th>
              <th className="hidden px-4 py-3 text-right sm:table-cell">Correct</th>
              <th className="hidden px-4 py-3 text-right sm:table-cell">Played</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ranked.map((row) => {
              const isMe = row.user_id === auth.userId;
              return (
                <tr key={row.user_id} className={isMe ? "bg-blue-50" : undefined}>
                  <td className="px-4 py-3 font-semibold tabular-nums">{row.rank}</td>
                  <td className="px-4 py-3 font-medium">
                    {row.full_name || "—"}
                    {isMe && (
                      <span className="ml-2 rounded bg-brand-accent px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
                        You
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{row.department || "—"}</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">
                    {row.total_points}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {row.exact_scores_count}
                  </td>
                  <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">
                    {row.correct_outcomes_count}
                  </td>
                  <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">
                    {row.predictions_count}
                  </td>
                </tr>
              );
            })}
            {ranked.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                  No players yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
