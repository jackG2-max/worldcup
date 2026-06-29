import { NextResponse } from "next/server";
import { getAdminOrNull } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeWinner } from "@/lib/api-football";
import { calculateMatchPoints } from "@/lib/points";
import type { Match } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Approve a synced result and award points.
 *
 * Idempotent: re-approving the same match keeps result_approved = true, leaves
 * result_approved_at unchanged, and simply recomputes (overwrites) points.
 *
 * Body: { match_id: string }
 */
export async function POST(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let matchId: string | undefined;
  try {
    const body = (await request.json()) as { match_id?: string };
    matchId = body.match_id;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!matchId) {
    return NextResponse.json({ error: "match_id is required" }, { status: 400 });
  }

  try {
    const db = createAdminClient();

    const { data, error } = await db
      .from("matches")
      .select("*")
      .eq("id", matchId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    const match = data as Match;

    if (match.home_score === null || match.away_score === null) {
      return NextResponse.json(
        { error: "Match has no synced result to approve." },
        { status: 400 },
      );
    }

    // Idempotent approval: only stamp approved_at the first time.
    const updates: Partial<Match> = {
      result_approved: true,
      winner: match.winner ?? computeWinner(match.home_score, match.away_score),
    };
    if (!match.result_approved) {
      updates.result_approved_at = new Date().toISOString();
    }

    const { error: updateError } = await db
      .from("matches")
      .update(updates)
      .eq("id", matchId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const scored = await calculateMatchPoints(db, match);

    return NextResponse.json({ approved: true, predictionsScored: scored });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
