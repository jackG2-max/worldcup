import { getMatchStateInfo } from "@/lib/match-state";
import type { MatchWithPrediction } from "@/lib/types";
import { Countdown } from "./Countdown";
import { LocalTime } from "./LocalTime";
import { PredictionForm } from "./PredictionForm";

export function MatchCard({ match }: { match: MatchWithPrediction }) {
  const info = getMatchStateInfo(match);
  const prediction = match.prediction;
  const hasResult = match.home_score !== null && match.away_score !== null;
  const home = match.home_team ?? "Home";
  const away = match.away_team ?? "Away";

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
            {match.group_name || match.stage || "Fixture"}
          </span>
          {match.kickoff_at && (
            <span className="text-sm text-gray-500">
              <LocalTime iso={match.kickoff_at} />
            </span>
          )}
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${info.badgeClass}`}>
          {info.label}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Team name={home} code={match.home_team_code} />
        <div className="flex flex-col items-center px-2">
          {hasResult ? (
            <span className="text-2xl font-bold tabular-nums">
              {match.home_score} – {match.away_score}
            </span>
          ) : (
            <span className="text-2xl font-bold text-gray-300">vs</span>
          )}
          {info.state === "open" && match.kickoff_at && (
            <Countdown kickoffAt={match.kickoff_at} />
          )}
        </div>
        <Team name={away} code={match.away_team_code} alignRight />
      </div>

      {/* Prediction area */}
      <div className="mt-3 border-t border-gray-100 pt-3">
        {info.state === "open" ? (
          <PredictionForm
            matchId={match.id}
            homeLabel={home}
            awayLabel={away}
            initialHome={prediction?.predicted_home_score ?? null}
            initialAway={prediction?.predicted_away_score ?? null}
          />
        ) : (
          <LockedPrediction
            prediction={prediction}
            calculated={!!prediction?.calculated}
          />
        )}
      </div>
    </article>
  );
}

function Team({
  name,
  code,
  alignRight,
}: {
  name: string;
  code: string | null;
  alignRight?: boolean;
}) {
  return (
    <div className={`flex min-w-0 flex-1 flex-col ${alignRight ? "items-end text-right" : ""}`}>
      <span className="truncate text-base font-semibold">{name}</span>
      {code && <span className="text-xs text-gray-400">{code}</span>}
    </div>
  );
}

function LockedPrediction({
  prediction,
  calculated,
}: {
  prediction: MatchWithPrediction["prediction"];
  calculated: boolean;
}) {
  if (!prediction) {
    return <p className="text-sm text-gray-400">No prediction submitted.</p>;
  }
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-500">
        Your prediction:{" "}
        <span className="font-semibold text-gray-900">
          {prediction.predicted_home_score} – {prediction.predicted_away_score}
        </span>
      </span>
      {calculated && (
        <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
          {prediction.points} pts
        </span>
      )}
    </div>
  );
}
