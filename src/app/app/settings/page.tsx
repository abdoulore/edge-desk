"use client";

import { useState } from "react";
import { Pause, Play, ArrowSquareOut } from "@phosphor-icons/react";
import { useDeskStatus } from "@/hooks/useDeskStatus";
import { Panel, StateBlock, Toast, PageHeader, Btn } from "@/components/ui";
import { fmtInterval, fmtPct, fmtTime, shortAddr } from "@/lib/format";
import {
  hasClientOperatorSecret,
  operatorFetchHeaders,
} from "@/lib/operatorSecret";
import { UI_COPY } from "@/lib/uiCopy";
import { toUserMessage } from "@/lib/userError";

export default function SettingsPage() {
  const { status, loading, error, refresh, operatorConfigured } = useDeskStatus({
    pollMs: 15000,
  });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const canOperate = operatorConfigured || hasClientOperatorSecret();

  async function setPaused(paused: boolean) {
    if (!canOperate) {
      setToast(UI_COPY.manualUnavailable);
      setTimeout(() => setToast(null), 3000);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/pause", {
        method: "POST",
        headers: operatorFetchHeaders(),
        body: JSON.stringify({ paused }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok) {
        setToast(toUserMessage(json.message || `Failed (${res.status})`, "pause"));
      } else {
        setToast(
          json.ok
            ? paused
              ? "Signal updates paused."
              : "Signal updates resumed."
            : toUserMessage(json.message || "Failed", "pause"),
        );
      }
      await refresh();
    } catch (e) {
      setToast(toUserMessage(e, "pause"));
    } finally {
      setBusy(false);
      setTimeout(() => setToast(null), 3000);
    }
  }

  if (loading && !status) {
    return (
      <StateBlock
        kind="loading"
        title="Loading settings..."
        detail="Getting desk configuration."
      />
    );
  }
  if (error && !status) {
    return (
      <StateBlock
        kind="error"
        title="Settings unavailable"
        detail="We couldn't load desk settings. Try refreshing."
      />
    );
  }

  const cfg = status?.config;
  const dryRun = cfg?.dryRun ?? status?.dryRun;
  const tradingRows: Array<{ label: string; value: string; hint?: string }> = [
    {
      label: "Edge threshold",
      value: fmtPct(cfg?.edgeThreshold ?? 0.05, 0),
      hint: "Minimum executable edge required before Edge Desk produces a trade signal.",
    },
    {
      label: "Trade size",
      value: String(cfg?.copySize ?? 1),
      hint: "Default size used when trading a signal.",
    },
    {
      label: "Preferred asset",
      value: cfg?.preferredAsset || "BTC",
      hint: "Asset Edge Desk tries to prioritize when several markets are active.",
    },
    {
      label: "Preferred market length",
      value: fmtInterval(cfg?.preferredIntervalSec ?? 900),
      hint: "Market duration Edge Desk tries to prioritize.",
    },
  ];

  const signalRows: Array<{ label: string; value: string }> = [
    {
      label: "Update frequency",
      value: cfg?.agentIntervalMs
        ? `${Math.round(cfg.agentIntervalMs / 1000)}s`
        : "-",
    },
    {
      label: "Status",
      value: status?.paused
        ? "Paused"
        : status?.agentStalled
          ? "Not updating"
          : status?.agentRunning
            ? "Running"
            : "Idle",
    },
    {
      label: "Automatic trading",
      value: cfg?.agentTrade ? "On" : "Off, signals only",
    },
    {
      label: "Last update",
      value: status?.lastTickAt ? fmtTime(status.lastTickAt) : "-",
    },
  ];

  const networkRows: Array<{ label: string; value: string }> = [
    { label: "Network", value: cfg?.network || status?.network || "-" },
    {
      label: "Mode",
      value: dryRun ? "Signal only" : "Automatic trading",
    },
    {
      label: "DreamDEX venue",
      value: cfg?.venueId ? shortAddr(cfg.venueId, 10, 8) : "-",
    },
    {
      label: "Automation wallet",
      value: status?.wallet
        ? shortAddr(status.wallet)
        : "None configured",
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <PageHeader kicker="Settings" title="Desk settings" />

      <Panel title="Trading rules">
        <dl className="overflow-hidden rounded-desk border border-desk-border divide-y divide-desk-border">
          {tradingRows.map((r) => (
            <div
              key={r.label}
              className="flex flex-wrap items-center justify-between gap-2 bg-black/20 px-4 py-3 text-sm"
              title={r.hint}
            >
              <dt className="text-desk-muted">{r.label}</dt>
              <dd className="font-mono text-desk-ink tabular">{r.value}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel title="Signal updates">
        <p className="mb-3 text-sm text-desk-muted">
          Pause stops Edge Desk from updating signals. Trading and claiming
          still use your connected wallet.
        </p>
        <dl className="mb-4 overflow-hidden rounded-desk border border-desk-border divide-y divide-desk-border">
          {signalRows.map((r) => (
            <div
              key={r.label}
              className="flex flex-wrap items-center justify-between gap-2 bg-black/20 px-4 py-3 text-sm"
            >
              <dt className="text-desk-muted">{r.label}</dt>
              <dd className="font-mono text-desk-ink tabular">{r.value}</dd>
            </div>
          ))}
        </dl>
        {!canOperate && (
          <p className="mb-3 rounded-desk border border-desk-warn/30 bg-desk-warn/5 px-3 py-2 text-xs text-desk-warn">
            Manual pause controls are unavailable on this deployment. Local
            deployments can enable these controls in Advanced settings.
          </p>
        )}
        <Btn
          variant="secondary"
          disabled={busy || !canOperate}
          onClick={() => void setPaused(!status?.paused)}
          className="gap-2"
          title={canOperate ? undefined : UI_COPY.manualUnavailable}
        >
          {status?.paused ? (
            <Play size={14} weight="fill" />
          ) : (
            <Pause size={14} weight="fill" />
          )}
          {busy
            ? "Updating..."
            : !canOperate
              ? "Manual controls unavailable"
              : status?.paused
                ? "Resume signal updates"
                : "Pause signal updates"}
        </Btn>
      </Panel>

      <Panel title="Network">
        <dl className="overflow-hidden rounded-desk border border-desk-border divide-y divide-desk-border">
          {networkRows.map((r) => (
            <div
              key={r.label}
              className="flex flex-wrap items-center justify-between gap-2 bg-black/20 px-4 py-3 text-sm"
            >
              <dt className="text-desk-muted">{r.label}</dt>
              <dd className="font-mono text-desk-ink tabular">{r.value}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel
        title="Advanced"
        action={
          <button
            type="button"
            className="text-xs text-desk-muted hover:text-desk-ink"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            {showAdvanced ? "Hide" : "Show"}
          </button>
        }
      >
        <p className="text-sm text-desk-muted">
          Deployment and debugging details. Most users do not need to change
          these values.
        </p>
        {showAdvanced && (
          <div className="mt-3 space-y-3 text-sm">
            <dl className="overflow-hidden rounded-desk border border-desk-border divide-y divide-desk-border">
              {[
                {
                  label: "Full venue ID",
                  value: cfg?.venueId || "-",
                },
                {
                  label: "Manual controls",
                  value: canOperate ? "Enabled" : "Unavailable",
                },
                {
                  label: "Server wallet",
                  value: status?.wallet || "none",
                },
                {
                  label: "Config source",
                  value: "Environment / deployment settings",
                },
              ].map((r) => (
                <div
                  key={r.label}
                  className="flex flex-wrap items-start justify-between gap-2 bg-black/20 px-4 py-3 text-sm"
                >
                  <dt className="text-desk-muted">{r.label}</dt>
                  <dd className="max-w-[60%] break-all text-right font-mono text-desk-ink tabular">
                    {r.value}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-desk-muted">
              Local deployments can enable manual controls by setting matching
              operator credentials in environment settings, then restarting.
              Never commit real secrets.
            </p>
          </div>
        )}
      </Panel>

      <Panel title="Resources">
        <ul className="space-y-2 text-sm">
          {[
            { href: "https://docs.dreamdex.io", label: "DreamDEX documentation" },
            {
              href: "https://shannon-explorer.somnia.network",
              label: "Shannon explorer",
            },
            {
              href: "https://github.com/abdoulore/edge-desk",
              label: "Edge Desk source code",
            },
          ].map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-desk-accent hover:underline"
              >
                {l.label}
                <ArrowSquareOut size={13} />
              </a>
            </li>
          ))}
        </ul>
      </Panel>

      {toast && <Toast message={toast} />}
    </div>
  );
}
