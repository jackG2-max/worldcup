import type { Winner } from "./types";

/**
 * Minimal server-side client for API-Football (https://www.api-football.com/).
 * The API key is read from env and never sent to the browser.
 */

// ── Response shapes (only the fields we use) ─────────────────────────────────
interface ApiTeam {
  id: number;
  name: string;
}

export interface ApiFixture {
  fixture: {
    id: number;
    date: string; // ISO-8601 with timezone offset
    status: { short: string; long: string };
  };
  league: {
    id: number;
    season: number;
    round: string; // e.g. "Group Stage - 1", "Round of 16"
  };
  teams: { home: ApiTeam; away: ApiTeam };
  goals: { home: number | null; away: number | null };
}

interface ApiResponse<T> {
  response: T[];
  errors?: unknown;
  results?: number;
}

/** A normalized fixture row ready to upsert into `matches`. */
export interface MappedFixture {
  api_match_id: string;
  home_team: string;
  away_team: string;
  home_team_code: string;
  away_team_code: string;
  kickoff_at: string;
  stage: string;
  group_name: string | null;
  status: string;
}

const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);

export function isFinished(statusShort: string): boolean {
  return FINISHED_STATUSES.has(statusShort);
}

export function computeWinner(home: number, away: number): Winner {
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
}

function host(): string {
  return process.env.API_FOOTBALL_HOST ?? "v3.football.api-sports.io";
}

function authHeaders(): Record<string, string> {
  const key = process.env.API_FOOTBALL_KEY ?? "";
  const h = host();
  // RapidAPI and direct (api-sports.io) use different auth headers.
  if (h.includes("rapidapi")) {
    return { "x-rapidapi-key": key, "x-rapidapi-host": h };
  }
  return { "x-apisports-key": key };
}

async function apiGet<T>(path: string): Promise<ApiResponse<T>> {
  if (!process.env.API_FOOTBALL_KEY) {
    throw new Error("API_FOOTBALL_KEY is not set.");
  }

  const res = await fetch(`https://${host()}${path}`, {
    headers: authHeaders(),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`API-Football request failed (${res.status} ${res.statusText}).`);
  }

  const json = (await res.json()) as ApiResponse<T>;

  // API-Football returns 200 with an `errors` object on auth/quota problems.
  if (json.errors && typeof json.errors === "object" && !Array.isArray(json.errors)) {
    const entries = Object.entries(json.errors as Record<string, string>);
    if (entries.length > 0) {
      throw new Error(`API-Football error: ${entries.map(([k, v]) => `${k}: ${v}`).join("; ")}`);
    }
  }

  return json;
}

/** Best-effort 3-letter team code (API-Football fixtures don't include one). */
function teamCode(name: string): string {
  return name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
}

/** Parse "Group A" out of a round string when present. */
function groupName(round: string): string | null {
  const m = round.match(/Group\s+([A-Z])/i);
  return m ? `Group ${m[1].toUpperCase()}` : null;
}

export function mapFixture(fx: ApiFixture): MappedFixture {
  return {
    api_match_id: String(fx.fixture.id),
    home_team: fx.teams.home.name,
    away_team: fx.teams.away.name,
    home_team_code: teamCode(fx.teams.home.name),
    away_team_code: teamCode(fx.teams.away.name),
    // fx.fixture.date is an ISO string with tz offset; Postgres timestamptz
    // stores it as UTC.
    kickoff_at: new Date(fx.fixture.date).toISOString(),
    stage: fx.league.round ?? "",
    group_name: groupName(fx.league.round ?? ""),
    status: fx.fixture.status.short,
  };
}

function leagueId(): string {
  return process.env.API_FOOTBALL_LEAGUE_ID ?? "1";
}

function season(): string {
  return process.env.API_FOOTBALL_SEASON ?? "2026";
}

/** Fetch every fixture for the configured World Cup league + season. */
export async function fetchWorldCupFixtures(): Promise<ApiFixture[]> {
  const json = await apiGet<ApiFixture>(
    `/fixtures?league=${leagueId()}&season=${season()}`,
  );
  return json.response ?? [];
}
