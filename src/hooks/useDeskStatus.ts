"use client";

import { useCallback, useEffect, useState } from "react";
import type { DeskStatus } from "@/lib/types";
import {
  hasClientOperatorSecret,
  operatorFetchHeaders,
} from "@/lib/operatorSecret";

export function useDeskStatus(opts?: {
  pollMs?: number;
  autoTick?: boolean;
}) {
  const pollMs = opts?.pollMs ?? 8000;
  const [status, setStatus] = useState<DeskStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"tick" | null>(null);
  const operatorConfigured = hasClientOperatorSecret();

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
    if (!hasClientOperatorSecret()) {
      setError("Operator secret not configured — cannot force tick");
      return;
    }
    setBusy("tick");
    try {
      const res = await fetch("/api/agent/tick", {
        method: "POST",
        headers: operatorFetchHeaders(),
      });
      const json = (await res.json().catch(() => ({}))) as {
        message?: string;
        ok?: boolean;
      };
      if (!res.ok) {
        setError(json.message || `Tick failed (${res.status})`);
      }
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

  return {
    status,
    loading,
    error,
    busy,
    refresh,
    tick,
    operatorConfigured,
  };
}
