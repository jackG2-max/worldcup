import type { Winner } from "./types";

/**
 * Scoring rules
 * ─────────────
 *   Exact score ................ 10 points
 *   Correct winner/draw ........  3 points
 *   + correct goal difference ..  2 bonus points
 *   + correct total goals ......  1 bonus point
 *
 * The bonus points are only awarded on top of a correct outcome, which is why
 * the worked example "France 1 - 2 Argentina" (correct total goals but wrong
 * winner) scores 0.
 *
 * NOTE on "maximum 13": the rules as written cannot actually produce 13. If you
 * get the outcome, goal difference *and* total goals all correct, you have by
 * definition predicted the exact score, which short-circuits to a flat 10. The
 * realistic per-match ceiling is therefore 10. We implement the four worked
 * examples (10 / 5 / 3 / 0) exactly; see README for the discrepancy note.
 */
export const POINTS = {
  EXACT: 10,
  OUTCOME: 3,
  GOAL_DIFF_BONUS: 2,
  TOTAL_GOALS_BONUS: 1,
} as const;

export function outcomeOf(home: number, away: number): Winner {
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
}

/**
 * Points for a single prediction against the actual result.
 * Pure and deterministic — calling it repeatedly is idempotent.
 */
export function calculatePoints(
  predHome: number,
  predAway: number,
  actualHome: number,
  actualAway: number,
): number {
  // Exact score.
  if (predHome === actualHome && predAway === actualAway) {
    return POINTS.EXACT;
  }

  // Wrong winner/draw → no points (bonuses require a correct outcome).
  if (outcomeOf(predHome, predAway) !== outcomeOf(actualHome, actualAway)) {
    return 0;
  }

  let points = POINTS.OUTCOME;

  // Correct (signed) goal difference.
  if (predHome - predAway === actualHome - actualAway) {
    points += POINTS.GOAL_DIFF_BONUS;
  }

  // Correct total goals.
  if (predHome + predAway === actualHome + actualAway) {
    points += POINTS.TOTAL_GOALS_BONUS;
  }

  return points;
}
