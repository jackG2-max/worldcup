import { NextResponse } from "next/server";
import { getAdminOrNull } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchWorldCupFixtures, mapFixture } from "@/lib/api-football";

export const dynamic = "force-dynamic";

/**
 * Sync fixtures from API-Football into `matches`.
 *
 * - Upserts on `api_match_id`, so re-running never duplicates matches.
 * - Only fixture columns are written, so existing scores / approval flags and
 *   all user predictions (separate table) are preserved.
 */
export async function POST() {
  const admin = await getAdminOrNull();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const fixtures = await fetchWorldCupFixtures();
    const nowIso = new Date().toISOString();
    const rows = fixtures.map((fx) => ({ ...mapFixture(fx), updated_at: nowIso }));

    if (rows.length === 0) {
      return NextResponse.json({ synced: 0, message: "No fixtures returned by API-Football." });
    }

    const db = createAdminClient();
    const { error } = await db
      .from("matches")
      .upsert(rows, { onConflict: "api_match_id" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ synced: rows.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
