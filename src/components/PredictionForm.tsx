"use client";

import { useActionState, useEffect, useState } from "react";
import {
  submitPrediction,
  type PredictionActionState,
} from "@/app/matches/actions";

interface PredictionFormProps {
  matchId: string;
  homeLabel: string;
  awayLabel: string;
  initialHome: number | null;
  initialAway: number | null;
}

const initialState: PredictionActionState = { ok: false };

export function PredictionForm({
  matchId,
  homeLabel,
  awayLabel,
  initialHome,
  initialAway,
}: PredictionFormProps) {
  const [state, formAction, pending] = useActionState(submitPrediction, initialState);
  const [home, setHome] = useState(initialHome?.toString() ?? "");
  const [away, setAway] = useState(initialAway?.toString() ?? "");
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (state.ok) {
      setJustSaved(true);
      const t = setTimeout(() => setJustSaved(false), 2500);
      return () => clearTimeout(t);
    }
  }, [state]);

  return (
    <form action={formAction} className="mt-3">
      <input type="hidden" name="match_id" value={matchId} />
      <div className="flex items-end gap-3">
        <ScoreInput name="home" label={homeLabel} value={home} onChange={setHome} />
        <span className="pb-2 text-gray-400">–</span>
        <ScoreInput name="away" label={awayLabel} value={away} onChange={setAway} />
        <button
          type="submit"
          disabled={pending}
          className="ml-auto rounded-md bg-brand-accent px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>

      {state.error && (
        <p className="mt-2 text-sm text-red-600">{state.error}</p>
      )}
      {justSaved && (
        <p className="mt-2 text-sm text-emerald-600">Prediction saved ✓</p>
      )}
    </form>
  );
}

function ScoreInput({
  name,
  label,
  value,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col">
      <span className="mb-1 max-w-[7rem] truncate text-xs font-medium text-gray-500">
        {label}
      </span>
      <input
        name={name}
        type="number"
        inputMode="numeric"
        min={0}
        max={99}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-16 rounded-md border border-gray-300 px-3 py-2 text-center text-lg font-semibold shadow-sm focus:border-brand-accent focus:outline-none focus:ring-1 focus:ring-brand-accent"
      />
    </label>
  );
}
