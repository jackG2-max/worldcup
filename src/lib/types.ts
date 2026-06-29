export type Role = "user" | "admin";
export type Winner = "home" | "away" | "draw";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  department: string | null;
  role: Role;
  created_at: string;
}

export interface Match {
  id: string;
  api_match_id: string | null;
  home_team: string | null;
  away_team: string | null;
  home_team_code: string | null;
  away_team_code: string | null;
  kickoff_at: string | null;
  stage: string | null;
  group_name: string | null;
  status: string | null;
  home_score: number | null;
  away_score: number | null;
  winner: Winner | null;
  result_synced_at: string | null;
  result_approved: boolean;
  result_approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Prediction {
  id: string;
  user_id: string;
  match_id: string;
  predicted_home_score: number;
  predicted_away_score: number;
  points: number;
  calculated: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeaderboardRow {
  user_id: string;
  full_name: string | null;
  department: string | null;
  total_points: number;
  exact_scores_count: number;
  correct_outcomes_count: number;
  predictions_count: number;
}

/** A match row with the current user's prediction (if any) embedded. */
export interface MatchWithPrediction extends Match {
  prediction: Prediction | null;
}
