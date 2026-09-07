"use client";

import { ArrowsClockwise } from "@phosphor-icons/react";
import { useDeskStatus } from "@/hooks/useDeskStatus";
import { Badge, Panel, StateBlock, PageHeader } from "@/components/ui";
import { fmtDateTime, fmtPct, shortHash } from "@/lib/format";
import { explorerTxUrl, type ActivityEvent } from "@/lib/types";

function toneFor(kind: ActivityEvent["kind"]) {
  switch (kind) {
    case "trade":
    case "copy":
      return "up" as const;
    case "claim":
      return "cyan" as const;
    case "error":
      return "down" as const;
    default:
      return "neutral" as const;
  }
}

export default function ActivityPage() {
  const { status, loading, error, refresh } = useDeskStatus({ pollMs: 8000 });

  if (loading && !status) {
    return <StateBlock kind="loading" title="Loading activity..." />;
  }
  if (error && !status) {
    return (
      <StateBlock kind="error" title="Activity unavailable" detail={error} />
    );
  }

  const activity = status?.activity ?? [];
  const lastTrade = status?.signal?.lastTrade;

  const rows: ActivityEvent[] =
    activity.length > 0
      ? activity
      : lastTrade
        ? [
            {
              id: "last-trade",
              kind: "trade",
              at: lastTrade.at,
              title: `${lastTrade.side} fill${lastTrade.dryRun ? " (dry)" : ""}`,
              detail: lastTrade.reason,
              marketId: lastTrade.marketId,
              side: lastTrade.side,
              edge: lastTrade.edge,
              txHash: lastTrade.txHash,
              dryRun: lastTrade.dryRun,
            },
          ]
        : [];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <PageHeader
        kicker="Activity"
        title="Recent ticks and fills"
        action={
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex items-center gap-1.5 rounded-desk-sm border border-desk-border px-3 py-1.5 text-xs text-desk-muted transition hover:text-desk-ink"
          >
            <ArrowsClockwise size={13} />
            Refresh
          </button>
        }
      />

      {rows.length === 0 ? (
        <StateBlock
          kind="empty"
          title="No activity yet"
          detail="Agent ticks, trades, copies, and claims will appear in a rolling history."
        />
      ) : (
        <Panel className="!p-0 overflow-hidden">
          <ol className="divide-y divide-desk-border">
            {rows.map((ev) => (
              <li key={ev.id} className="flex gap-3 px-4 py-3.5">
                <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-desk-accent/80" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{ev.title}</span>
                    <Badge tone={toneFor(ev.kind)}>{ev.kind}</Badge>
                    {ev.side && (
                      <Badge tone={ev.side === "Up" ? "up" : "down"}>
                        {ev.side}
                      </Badge>
                    )}
                    {ev.edge != null && (
                      <span className="font-mono text-[11px] text-desk-muted tabular">
                        {fmtPct(ev.edge)}
                      </span>
                    )}
                  </div>
                  {ev.detail && (
                    <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-desk-muted">
                      {ev.detail}
                    </p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-desk-muted">
                    <span>{fmtDateTime(ev.at)}</span>
                    {ev.asset && <span>{ev.asset}</span>}
                    {ev.txHash && (
                      <a
                        href={explorerTxUrl(ev.txHash)}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-desk-accent hover:underline"
                      >
                        {shortHash(ev.txHash)}
                      </a>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      )}
    </div>
  );
}
