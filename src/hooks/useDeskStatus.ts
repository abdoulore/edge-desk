"use client";

import { useCallback, useEffect, useState } from "react";
import type { DeskStatus } from "@/lib/types";
import {
  hasClientOperatorSecret,
  operatorFetchHeaders,
} from "@/lib/operatorSecret";
import { toUserMessage } from "@/lib/userError";

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
      setError(toUserMessage(e, "status"));
    } finally {
      setLoading(false);
    }
  }, []);

  const tick = useCallback(async () => {
    if (!hasClientOperatorSecret()) {
      setError(
        "Manual signal checks are disabled on this deployment. Signals will continue to update automatically when the signal process is running.",
      );
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
        setError(toUserMessage(json.message || `Tick failed (${res.status})`, "tick"));
      }
      await refresh();
    } catch (e) {
      setError(toUserMessage(e, "tick"));
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
