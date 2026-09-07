"use client";

import { useState } from "react";
import { useDeskStatus } from "@/hooks/useDeskStatus";
import { Panel, StateBlock, Toast } from "@/components/ui";
import { fmtInterval, fmtPct, fmtTime, shortAddr } from "@/lib/format";

export default function SettingsPage() {
  const { status, loading, error, refresh } = useDeskStatus({ pollMs: 15000 });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function setPaused(paused: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string };
      setToast(json.ok ? (paused ? "Agent paused" : "Agent resumed") : json.message || "Failed");
      await refresh();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Pause failed");
    } finally {
      setBusy(false);
      setTimeout(() => setToast(null), 3000);
    }
  }

  if (loading && !status) {
    return <StateBlock kind="loading" title="Loading settings…" />;
  }
  if (error && !status) {
    return (
      <StateBlock kind="error" title="Settings unavailable" detail={error} />
    );
  }

  const cfg = status?.config;
  const rows: Array<{ label: string; value: string }> = [
    { label: "Network", value: cfg?.network || status?.network || "—" },
    {
      label: "Mode",
      value: (cfg?.dryRun ?? status?.dryRun) ? "DRY_RUN" : "LIVE",
    },
    {
      label: "Edge threshold",
      value: fmtPct(cfg?.edgeThreshold ?? 0.05, 0),
    },
    { label: "Copy size", value: String(cfg?.copySize ?? 1) },
    {
      label: "Preferred asset",
      value: cfg?.preferredAsset || "BTC",
    },
    {
      label: "Preferred interval",
      value: fmtInterval(cfg?.preferredIntervalSec ?? 900),
    },
    {
      label: "Agent interval",
      value: cfg?.agentIntervalMs
        ? `${Math.round(cfg.agentIntervalMs / 1000)}s`
        : "—",
    },
    {
      label: "Venue",
      value: cfg?.venueId ? shortAddr(cfg.venueId, 10, 8) : "—",
    },
    {
      label: "Agent trade",
      value: cfg?.agentTrade ? "enabled" : "off (signal-only)",
    },
    {
      label: "Paused",
      value: status?.paused ? "yes" : "no",
    },
    {
      label: "Last tick",
      value: status?.lastTickAt ? fmtTime(status.lastTickAt) : "—",
    },
    {
      label: "Agent",
      value: status?.agentStalled
        ? "stalled"
        : status?.agentRunning
          ? "running"
          : "idle",
    },
    {
      label: "Server wallet",
      value: status?.wallet
        ? shortAddr(status.wallet) + " (optional)"
        : "none (non-custodial)",
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-desk-muted">
          Settings
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Runtime config
        </h1>
      </div>

      <Panel title="Read-only">
        <p className="mb-4 text-sm text-desk-muted">
          These values come from the server status payload / process env. Edit{" "}
          <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-xs text-desk-cyan">
            .env
          </code>{" "}
          and restart to change them.
        </p>
        <dl className="divide-y divide-desk-border rounded-xl border border-desk-border overflow-hidden">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex flex-wrap items-center justify-between gap-2 bg-black/20 px-4 py-3 text-sm"
            >
              <dt className="text-desk-muted">{r.label}</dt>
              <dd className="font-mono text-zinc-100">{r.value}</dd>
            </div>
          ))}
        </dl>
        {cfg?.venueId && (
          <p className="mt-3 break-all font-mono text-[11px] text-desk-muted">
            Full venue: {cfg.venueId}
          </p>
        )}
      </Panel>

      <Panel title="Signal loop">
        <p className="mb-3 text-sm text-desk-muted">
          Pause stops the background agent from updating signals. Copy/Claim still
          use your connected wallet.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void setPaused(!status?.paused)}
          className="rounded-xl border border-desk-border bg-black/30 px-4 py-2 text-sm font-medium hover:border-desk-cyan/40 disabled:opacity-50"
        >
          {busy
            ? "…"
            : status?.paused
              ? "Resume agent"
              : "Pause signal loop"}
        </button>
      </Panel>

      <Panel title="Docs & explorers">
        <ul className="space-y-2 text-sm">
          <li>
            <a
              href="https://docs.dreamdex.io"
              target="_blank"
              rel="noreferrer"
              className="text-desk-cyan hover:underline"
            >
              docs.dreamdex.io ↗
            </a>
          </li>
          <li>
            <a
              href="https://shannon-explorer.somnia.network"
              target="_blank"
              rel="noreferrer"
              className="text-desk-cyan hover:underline"
            >
              Shannon explorer ↗
            </a>
          </li>
          <li>
            <a
              href="https://github.com/abdoulore/edge-desk"
              target="_blank"
              rel="noreferrer"
              className="text-desk-cyan hover:underline"
            >
              GitHub repo ↗
            </a>
          </li>
        </ul>
      </Panel>

      {toast && <Toast message={toast} />}
    </div>
  );
}
