"use client";

import { useEffect, useState } from "react";

/**
 * Renders a timestamp in the visitor's local timezone. Formatting happens after
 * mount to avoid server/client hydration mismatches; until then we show a
 * stable UTC-based fallback.
 */
export function LocalTime({ iso }: { iso: string }) {
  const [text, setText] = useState<string>(() =>
    new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC",
  );

  useEffect(() => {
    setText(
      new Date(iso).toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
  }, [iso]);

  return <time dateTime={iso} suppressHydrationWarning>{text}</time>;
}
