"use client";

import { useCallback, useEffect, useState } from "react";
import type { DeskStatus } from "@/lib/types";

export function useDeskStatus(opts?: {
  pollMs?: number;
  autoTick?: boolean;
}) {
  const pollMs = opts?.pollMs ?? 8000;
  const autoTick = opts?.autoTick ?? false;
  const [status, setStatus] = useState<DeskStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"copy" | "claim" | "tick" | null>(null);

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
    if (autoTick) {
      void tick();
      const poll = setInterval(() => void tick(), pollMs);
      return () => clearInterval(poll);
    }
    void refresh();
    const poll = setInterval(() => void refresh(), pollMs);
    return () => clearInterval(poll);
  }, [autoTick, pollMs, refresh, tick]);

  const copy = useCallback(async () => {
    setBusy("copy");
    try {
      const res = await fetch("/api/copy", { method: "POST" });
      const json = (await res.json()) as { ok: boolean; message: string };
      await refresh();
      return json;
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : "Copy failed",
      };
    } finally {
      setBusy(null);
    }
  }, [refresh]);

  const claim = useCallback(
    async (marketId?: string) => {
      const id = marketId || status?.claimable?.[0]?.marketId;
      if (!id) {
        return { ok: false, message: "Nothing claimable yet" };
      }
      setBusy("claim");
      try {
        const res = await fetch("/api/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ marketId: id }),
        });
        const json = (await res.json()) as { ok: boolean; message: string };
        await refresh();
        return json;
      } catch (e) {
        return {
          ok: false,
          message: e instanceof Error ? e.message : "Claim failed",
        };
      } finally {
        setBusy(null);
      }
    },
    [refresh, status?.claimable],
  );

  return {
    status,
    loading,
    error,
    busy,
    refresh,
    tick,
    copy,
    claim,
  };
}
