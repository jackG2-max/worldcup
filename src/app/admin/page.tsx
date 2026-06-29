import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hasResult } from "@/lib/match-state";
import { AdminActions } from "@/components/admin/AdminActions";
import { ApproveButton } from "@/components/admin/ApproveButton";
import { LocalTime } from "@/components/LocalTime";
import type { Match } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "Admin · Grey World Cup Predictions" };

export default async function AdminPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data } = await supabase
    .from("matches")
    .select("*")
    .order("kickoff_at", { ascending: true });

  const matches = (data ?? []) as Match[];
  const now = new Date();

  const needingSync = matches.filter(
    (m) => !hasResult(m) && !m.result_approved && m.kickoff_at !== null && new Date(m.kickoff_at) < now,
  );
  const pendingApproval = matches.filter((m) => hasResult(m) && !m.result_approved);
  const approved = matches.filter((m) => m.result_approved);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Admin dashboard</h1>
      <p className="mt-1 text-sm text-gray-500">
        Sync data from API-Football, then review and approve results to award points.
      </p>

      {/* Stats */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total matches" value={matches.length} />
        <Stat label="Need result sync" value={needingSync.length} tone="amber" />
        <Stat label="Pending approval" value={pendingApproval.length} tone="blue" />
        <Stat label="Approved" value={approved.length} tone="emerald" />
      </div>

      {/* Actions */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Actions</h2>
        <AdminActions />
      </section>

      {/* Pending approval */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">
          Results pending approval{" "}
          <span className="text-sm font-normal text-gray-400">
            ({pendingApproval.length})
          </span>
        </h2>
        {pendingApproval.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
            Nothing to approve. Run <span className="font-medium">Sync results</span> to
            pull finished matches.
          </p>
        ) : (
          <ul className="space-y-2">
            {pendingApproval.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {m.home_team} {m.home_score} – {m.away_score} {m.away_team}
                  </p>
                  <p className="text-xs text-gray-400">
                    {m.group_name || m.stage}
                    {m.result_synced_at && (
                      <>
                        {" · synced "}
                        <LocalTime iso={m.result_synced_at} />
                      </>
                    )}
                  </p>
                </div>
                <ApproveButton matchId={m.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Approved results */}
      {approved.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">
            Approved results{" "}
            <span className="text-sm font-normal text-gray-400">({approved.length})</span>
          </h2>
          <ul className="space-y-2">
            {approved.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3 text-sm"
              >
                <span className="truncate font-medium">
                  {m.home_team} {m.home_score} – {m.away_score} {m.away_team}
                </span>
                <span className="shrink-0 rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
                  Approved
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "gray",
}: {
  label: string;
  value: number;
  tone?: "gray" | "amber" | "blue" | "emerald";
}) {
  const tones: Record<string, string> = {
    gray: "text-gray-900",
    amber: "text-amber-600",
    blue: "text-blue-600",
    emerald: "text-emerald-600",
  };
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className={`text-3xl font-bold tabular-nums ${tones[tone]}`}>{value}</div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </div>
    </div>
  );
}
