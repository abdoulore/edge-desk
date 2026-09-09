"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  GithubLogo,
  Crosshair,
  CopySimple,
  SealCheck,
  Graph,
  Lightning,
} from "@phosphor-icons/react";
import type { DeskStatus } from "@/lib/types";
import { fmtPct, fmtTime } from "@/lib/format";
import BrandLogo from "@/components/BrandLogo";
import { formatModeLabel } from "@/lib/uiCopy";

const GITHUB = "https://github.com/abdoulore/edge-desk";

const STEPS = [
  {
    title: "Find active markets",
    body: "Watch currently trading BTC and ETH Up/Down windows on DreamDEX, with the preferred market shown first when it is available.",
  },
  {
    title: "Build a fair-value estimate",
    body: "Compare spot with the market's opening reference to produce a rule-based Fair Up estimate.",
  },
  {
    title: "Compare it with the market",
    body: "Measure the gap between the Fair Up estimate and the market price. A signal appears only when the executable edge clears the configured threshold.",
  },
  {
    title: "Trade or claim",
    body: "Trade a qualifying signal from your connected wallet. After a market resolves, claim eligible winning or voided positions.",
  },
];

const CAPABILITIES = [
  {
    title: "See why a signal appeared",
    body: "Every signal shows the spot move, Fair Up estimate, market price, edge, and the reason Edge Desk chose to trade or wait.",
    icon: Lightning,
    wide: true,
  },
  {
    title: "Trade the signal",
    body: "Use your connected wallet to take the current Up or Down signal. The desk still checks that the market is open and the price meets the configured edge.",
    icon: CopySimple,
    wide: false,
  },
  {
    title: "Claim settled positions",
    body: "See positions that are ready to redeem and claim them directly from your connected wallet.",
    icon: SealCheck,
    wide: false,
  },
  {
    title: "Verify the result",
    body: "Open the market's oracle resolution details to verify how the outcome was settled.",
    icon: Graph,
    wide: true,
  },
];

export default function LandingPage() {
  const reduce = useReducedMotion();
  const [live, setLive] = useState<DeskStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as DeskStatus;
        if (!cancelled) setLive(json);
      } catch {
        /* graceful offline */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const edge = live?.signal?.edge;
  const edgeLabel =
    edge == null ? null : `${edge >= 0 ? "+" : ""}${fmtPct(edge)}`;

  const fade = (delay = 0) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: {
            duration: 0.55,
            delay,
            ease: [0.16, 1, 0.3, 1] as const,
          },
        };

  return (
    <div className="landing-root relative min-h-[100dvh] overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 landing-grid opacity-50" />

      <header className="relative z-10 mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 md:px-8">
        <div className="flex items-center gap-2.5">
          <BrandLogo size={32} priority />
          <div>
            <p className="text-sm font-semibold tracking-tight">Edge Desk</p>
            <p className="text-[10px] text-desk-muted">Somnia × DreamDEX</p>
          </div>
        </div>
        <nav className="flex items-center gap-2 sm:gap-3">
          <a
            href={GITHUB}
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1.5 rounded-full border border-desk-border px-3 py-1.5 text-xs text-desk-muted transition hover:border-desk-accent/40 hover:text-desk-accent sm:inline-flex"
          >
            <GithubLogo size={14} weight="bold" />
            GitHub
          </a>
          <Link
            href="/app/desk"
            className="inline-flex items-center gap-1 rounded-full bg-desk-accent px-3.5 py-1.5 text-xs font-semibold text-black transition hover:bg-desk-accent/90 active:scale-[0.98]"
          >
            Open desk
          </Link>
        </nav>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-20 md:px-8">
        <section className="grid min-h-[calc(100dvh-4rem)] gap-10 pb-16 pt-10 md:grid-cols-[1.15fr_0.85fr] md:items-center md:gap-12 md:pb-20 md:pt-8">
          <motion.div {...fade(0)}>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-desk-border bg-desk-panel/80 px-3 py-1 text-[11px] font-medium text-desk-muted">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-desk-accent" />
              Event Contracts on Somnia Shannon
            </p>
            <h1 className="max-w-xl text-4xl font-semibold leading-[1.08] tracking-tight text-balance text-desk-ink sm:text-5xl lg:text-[3.35rem]">
              Spot moved.
              <span className="mt-1 block text-desk-accent">
                The market hasn&apos;t caught up.
              </span>
            </h1>
            <p className="mt-5 max-w-[42ch] text-base leading-relaxed text-desk-muted sm:text-lg">
              Edge Desk watches short BTC and ETH Up/Down markets on DreamDEX,
              compares spot with the market, and flags pricing gaps with a clear
              explanation.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/app/desk"
                className="inline-flex items-center justify-center gap-2 rounded-desk bg-desk-accent px-5 py-3 text-sm font-semibold text-black shadow-desk-accent transition hover:bg-desk-accent/90 active:scale-[0.98]"
              >
                Open desk
                <ArrowRight size={16} weight="bold" />
              </Link>
              <a
                href={GITHUB}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-desk border border-desk-border bg-desk-panel px-5 py-3 text-sm font-semibold text-desk-ink transition hover:border-desk-accent/40 hover:text-desk-accent active:scale-[0.98]"
              >
                <GithubLogo size={16} weight="bold" />
                View source
              </a>
            </div>
          </motion.div>

          <motion.div {...fade(0.12)} className="relative">
            <div className="absolute -inset-3 rounded-[20px] bg-desk-accent/[0.04] blur-2xl" />
            <div className="relative rounded-desk-lg border border-desk-border bg-desk-panel/95 p-5 shadow-desk backdrop-blur">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Crosshair size={16} className="text-desk-accent" weight="duotone" />
                  <p className="text-xs font-medium text-desk-muted">Live signal</p>
                </div>
                {live ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-desk-accent/30 bg-desk-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-desk-accent">
                    <span className="live-dot h-1.5 w-1.5 rounded-full bg-desk-accent" />
                    {formatModeLabel({
                      paused: live.paused,
                      dryRun: live.dryRun,
                    })}{" "}
                    · {live.network}
                  </span>
                ) : (
                  <span className="rounded-full border border-desk-border px-2.5 py-0.5 text-[11px] text-desk-muted">
                    Unavailable
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <HeroStat label="Market" value={live?.signal?.asset || "BTC"} />
                <HeroStat
                  label="Edge"
                  value={edgeLabel || "-"}
                  accent={edge != null && Math.abs(edge) >= 0.05}
                />
                <HeroStat
                  label="Up midpoint"
                  value={
                    live?.signal?.upMid != null
                      ? fmtPct(live.signal.upMid)
                      : "-"
                  }
                />
                <HeroStat
                  label="Updated"
                  value={fmtTime(live?.signal?.updatedAt || live?.lastTickAt)}
                />
              </div>
              <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-desk-ink/80">
                {live?.signal?.reason ||
                  "Signal service unavailable. You can still open the desk. Live signals will return when the signal process is running."}
              </p>
            </div>
          </motion.div>
        </section>

        <section className="pb-20">
          <h2 className="max-w-xl text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            How Edge Desk finds an edge
          </h2>
          <p className="mt-2 max-w-[55ch] text-sm text-desk-muted sm:text-base">
            Every signal follows the same rule-based process, and the numbers
            are visible in the desk.
          </p>
          <ol className="mt-8 grid gap-0 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li
                key={s.title}
                className="relative border-t border-desk-border pt-5 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0 lg:first:border-l-0 lg:first:pl-0"
              >
                <span className="mb-3 flex h-7 w-7 items-center justify-center rounded-full border border-desk-accent/25 bg-desk-accent/5 font-mono text-[11px] font-semibold text-desk-accent tabular">
                  {i + 1}
                </span>
                <h3 className="text-base font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-desk-muted">
                  {s.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section className="pb-20">
          <div className="overflow-hidden rounded-desk-lg border border-desk-border bg-desk-panel">
            <div className="grid md:grid-cols-[0.9fr_1.1fr]">
              <div className="border-b border-desk-border bg-desk-accent/[0.06] p-6 md:border-b-0 md:border-r md:p-10">
                <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                  What creates an edge?
                </h2>
              </div>
              <div className="space-y-4 p-6 text-sm leading-relaxed text-desk-muted md:p-10 md:text-base">
                <p>
                  DreamDEX Event Contracts let traders take an Up or Down
                  position on whether BTC or ETH finishes above a reference
                  price at the end of a short window. The Up token trades
                  between 0 and 1.
                </p>
                <p>
                  Edge Desk compares the current spot price with the window&apos;s
                  reference and builds a rule-based Fair Up estimate. When that
                  estimate differs enough from the price available in the
                  market, the desk can produce a trade signal.
                </p>
                <p>
                  The estimate is a transparent heuristic, not a calibrated
                  probability of winning.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="pb-20">
          <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            Built to show its work
          </h2>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {CAPABILITIES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className={`flex gap-4 rounded-desk-lg border border-desk-border bg-desk-panel/70 p-5 transition hover:border-desk-accent/25 ${
                    f.wide ? "sm:col-span-2 md:col-span-1" : ""
                  }`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-desk-sm border border-desk-accent/20 bg-desk-accent/5 text-desk-accent">
                    <Icon size={20} weight="duotone" />
                  </span>
                  <div>
                    <h3 className="font-semibold">{f.title}</h3>
                    <p className="mt-1.5 max-w-[50ch] text-sm leading-relaxed text-desk-muted">
                      {f.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="pb-16">
          <p className="mb-3 text-sm text-desk-muted">Runs on</p>
          <div className="flex flex-wrap gap-2">
            {[
              "Somnia Shannon",
              "DreamDEX Event Contracts",
              "Next.js",
              "markets-sdk",
            ].map((t) => (
              <span
                key={t}
                className="rounded-full border border-desk-border bg-black/30 px-3.5 py-1.5 text-xs font-medium text-desk-ink/80"
              >
                {t}
              </span>
            ))}
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-desk-border/80 bg-black/25">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-desk-muted md:flex-row md:items-center md:justify-between md:px-8">
          <p>Edge Desk · Somnia × DreamDEX Event Contracts</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/app/desk" className="hover:text-desk-accent">
              Open desk
            </Link>
            <a
              href={GITHUB}
              target="_blank"
              rel="noreferrer"
              className="hover:text-desk-accent"
            >
              GitHub
            </a>
            <a
              href="https://docs.dreamdex.io"
              target="_blank"
              rel="noreferrer"
              className="hover:text-desk-accent"
            >
              DreamDEX docs
            </a>
            <a
              href="https://shannon-explorer.somnia.network"
              target="_blank"
              rel="noreferrer"
              className="hover:text-desk-accent"
            >
              Shannon explorer
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function HeroStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-desk-sm border border-desk-border/80 bg-black/30 px-3 py-2.5">
      <p className="text-[10px] font-medium text-desk-muted">{label}</p>
      <p
        className={`mt-0.5 font-mono text-lg font-semibold tabular ${
          accent ? "text-desk-accent" : "text-desk-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
