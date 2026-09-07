"use client";

import { useCallback, useEffect, useState } from "react";
import type { DeskStatus } from "@/lib/types";

export function useDeskStatus(opts?: {
  pollMs?: number;
  autoTick?: boolean;
}) {
  const pollMs = opts?.pollMs ?? 8000;
  const [status, setStatus] = useState<DeskStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"tick" | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/status", { cache: "no-store" });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const json = (await res.json()) as DeskStatus;
      setStatus(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status fetch failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const tick = useCallback(async () => {
    setBusy("tick");
    try {
      await fetch("/api/agent/tick", { method: "POST" });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tick failed");
    } finally {
      setBusy(null);
    }
  }, [refresh]);

  useEffect(() => {
    void refresh();
    const poll = setInterval(() => void refresh(), pollMs);
    return () => clearInterval(poll);
  }, [pollMs, refresh]);

  return { status, loading, error, busy, refresh, tick };
}
