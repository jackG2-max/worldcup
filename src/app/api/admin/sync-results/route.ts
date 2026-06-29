import { NextResponse } from "next/server";
import { getAdminOrNull } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  computeWinner,
  fetchWorldCupFixtures,
  isFinished,
} from "@/lib/api-football";

export const dynamic = "force-dynamic";

/**
 * Sync final scores from API-Football.
 *
 * - Updates home_score / away_score / status / winner / result_synced_at for
 *   finished fixtures that already exist as matches.
 * - Does NOT touch already-approved matches (so an approved result is never
 *   clobbered) and never calculates points — results surface in the admin
 *   dashboard as "pending approval".
 */
export async function POST() {
  const admin = await getAdminOrNull();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const fixtures = await fetchWorldCupFixtures();
    const db = createAdminClient();

    // Map api_match_id -> { id, result_approved } for matches we already have.
    const { data: existing, error: loadError } = await db
      .from("matches")
      .select("id, api_match_id, result_approved");
    if (loadError) {
      return NextResponse.json({ error: loadError.message }, { status: 500 });
    }

    const byApiId = new Map(
      (existing ?? []).map((m) => [m.api_match_id as string, m]),
    );

    const nowIso = new Date().toISOString();
    const updates: PromiseLike<{ ok: boolean }>[] = [];
    let pending = 0;

    for (const fx of fixtures) {
      if (!isFinished(fx.fixture.status.short)) continue;
      const { home, away } = fx.goals;
      if (home === null || away === null) continue;

      const match = byApiId.get(String(fx.fixture.id));
      if (!match) continue; // sync fixtures first
      if (match.result_approved) continue; // never overwrite an approved result

      pending += 1;
      updates.push(
        db
          .from("matches")
          .update({
            home_score: home,
            away_score: away,
            status: fx.fixture.status.short,
            winner: computeWinner(home, away),
            result_synced_at: nowIso,
            updated_at: nowIso,
          })
          .eq("id", match.id)
          .then(({ error }) => ({ ok: !error })),
      );
    }

    const results = await Promise.all(updates);
    const synced = results.filter((r) => r.ok).length;

    return NextResponse.json({ synced, pendingApproval: pending });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
