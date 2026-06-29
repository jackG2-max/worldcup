import type { Match } from "./types";

export type MatchState = "open" | "locked" | "result_pending" | "result_approved";

export interface MatchStateInfo {
  state: MatchState;
  label: string;
  /** Tailwind classes for a badge representing the state. */
  badgeClass: string;
}

const LABELS: Record<MatchState, string> = {
  open: "Open for prediction",
  locked: "Locked",
  result_pending: "Result pending",
  result_approved: "Result approved",
};

const BADGES: Record<MatchState, string> = {
  open: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200",
  locked: "bg-amber-100 text-amber-800 ring-1 ring-amber-200",
  result_pending: "bg-blue-100 text-blue-800 ring-1 ring-blue-200",
  result_approved: "bg-gray-200 text-gray-800 ring-1 ring-gray-300",
};

export function hasResult(match: Match): boolean {
  return match.home_score !== null && match.away_score !== null;
}

export function isOpen(match: Match, now: Date = new Date()): boolean {
  return !!match.kickoff_at && new Date(match.kickoff_at) > now;
}

export function getMatchState(match: Match, now: Date = new Date()): MatchState {
  if (match.result_approved) return "result_approved";
  if (hasResult(match)) return "result_pending";
  if (isOpen(match, now)) return "open";
  return "locked";
}

export function getMatchStateInfo(match: Match, now: Date = new Date()): MatchStateInfo {
  const state = getMatchState(match, now);
  return { state, label: LABELS[state], badgeClass: BADGES[state] };
}
