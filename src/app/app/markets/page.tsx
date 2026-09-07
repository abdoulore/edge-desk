"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowsClockwise } from "@phosphor-icons/react";
import { useDeskStatus } from "@/hooks/useDeskStatus";
import { Badge, Panel, StateBlock, PageHeader } from "@/components/ui";
import { fmtCountdown, fmtInterval, fmtPct } from "@/lib/format";

export default function MarketsPage() {
  const { status, loading, error, refresh } = useDeskStatus({ pollMs: 10000 });
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (loading && !status) {
    return <StateBlock kind="loading" title="Loading markets..." />;
  }
  if (error && !status) {
    return (
      <StateBlock kind="error" title="Could not load markets" detail={error} />
    );
  }

  const markets = status?.markets ?? [];
  const focused = status?.signal?.marketId;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <PageHeader
        kicker="Markets"
        title="Live binary windows"
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

      {markets.length === 0 ? (
        <StateBlock
          kind="empty"
          title="No markets in cache yet"
          detail="Run a desk tick to populate live binary markets from the venue."
        />
      ) : (
        <Panel className="!p-0 overflow-hidden">
          <ul className="divide-y divide-desk-border">
            {markets.map((m) => {
              const active =
                focused &&
                m.marketId.toLowerCase() === focused.toLowerCase();
              return (
                <li key={m.marketId}>
                  <Link
                    href={`/app/desk?market=${encodeURIComponent(m.marketId)}`}
                    className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-white/[0.03] ${
                      active ? "bg-desk-accent/5" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{m.asset || "-"}</span>
                        <Badge>{fmtInterval(m.intervalSec)}</Badge>
                        <Badge
                          tone={m.status === "Trading" ? "up" : "neutral"}
                        >
                          {m.status}
                        </Badge>
                        {active && <Badge tone="cyan">focused</Badge>}
                      </div>
                      <p className="mt-1 truncate font-mono text-[11px] text-desk-muted">
                        {m.symbol || m.marketId}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm tabular text-desk-accent">
                        {m.upMid != null ? fmtPct(m.upMid) : "-"}
                      </p>
                      {m.upMid == null && (
                        <p className="text-[10px] text-desk-muted">no book</p>
                      )}
                      <p
                        className="font-mono text-[11px] text-desk-muted tabular"
                        suppressHydrationWarning
                      >
                        {fmtCountdown(m.expiry, now)} left
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </div>
  );
}
