import { NextResponse } from "next/server";
import { getAdminOrNull } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateMatchPoints } from "@/lib/points";
import type { Match } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Recalculate points across every approved result. Idempotent — points are
 * overwritten per prediction, so this can be run as often as needed (e.g. after
 * a scoring-rule tweak or a corrected score).
 */
export async function POST() {
  const admin = await getAdminOrNull();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const db = createAdminClient();

    const { data, error } = await db
      .from("matches")
      .select("*")
      .eq("result_approved", true);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const matches = (data ?? []) as Match[];
    let predictionsScored = 0;

    for (const match of matches) {
      predictionsScored += await calculateMatchPoints(db, match);
    }

    return NextResponse.json({
      matchesProcessed: matches.length,
      predictionsScored,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
