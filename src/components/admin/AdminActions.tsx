"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ActionDef {
  key: string;
  label: string;
  endpoint: string;
  description: string;
  variant?: "primary" | "default";
}

const ACTIONS: ActionDef[] = [
  {
    key: "sync-fixtures",
    label: "Sync fixtures",
    endpoint: "/api/admin/sync-fixtures",
    description: "Pull the latest World Cup fixtures from API-Football.",
    variant: "primary",
  },
  {
    key: "sync-results",
    label: "Sync results",
    endpoint: "/api/admin/sync-results",
    description: "Pull final scores for finished matches (pending approval).",
  },
  {
    key: "recalculate-points",
    label: "Recalculate points",
    endpoint: "/api/admin/recalculate-points",
    description: "Re-score every approved result. Safe to run repeatedly.",
  },
];

export function AdminActions() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  async function run(action: ActionDef) {
    setBusy(action.key);
    setFeedback(null);
    try {
      const res = await fetch(action.endpoint, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
      setFeedback({ ok: true, text: `${action.label}: ${summarize(json)}` });
      router.refresh();
    } catch (err) {
      setFeedback({
        ok: false,
        text: `${action.label} failed: ${err instanceof Error ? err.message : "error"}`,
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        {ACTIONS.map((action) => (
          <div key={action.key} className="rounded-lg border border-gray-200 bg-white p-4">
            <button
              onClick={() => run(action)}
              disabled={busy !== null}
              className={`w-full rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60 ${
                action.variant === "primary"
                  ? "bg-brand-accent text-white hover:bg-blue-700"
                  : "border border-gray-300 text-gray-700 hover:bg-gray-100"
              }`}
            >
              {busy === action.key ? "Working…" : action.label}
            </button>
            <p className="mt-2 text-xs text-gray-500">{action.description}</p>
          </div>
        ))}
      </div>

      {feedback && (
        <p
          className={`mt-3 rounded-md px-3 py-2 text-sm ${
            feedback.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}
        >
          {feedback.text}
        </p>
      )}
    </div>
  );
}

function summarize(json: Record<string, unknown>): string {
  return (
    Object.entries(json)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ") || "done"
  );
}
