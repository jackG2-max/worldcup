"use client";

import { useEffect, useState } from "react";

function format(ms: number): string {
  if (ms <= 0) return "Kickoff!";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

/** Live "time until kickoff" countdown. Renders nothing once kickoff passes. */
export function Countdown({ kickoffAt }: { kickoffAt: string }) {
  const target = new Date(kickoffAt).getTime();
  const [remaining, setRemaining] = useState<number>(() => target - Date.now());

  useEffect(() => {
    const id = setInterval(() => setRemaining(target - Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (remaining <= 0) return null;

  return (
    <span className="tabular-nums text-xs font-medium text-gray-500">
      Locks in {format(remaining)}
    </span>
  );
}
