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

const GITHUB = "https://github.com/abdoulore/edge-desk";

const STEPS = [
  {
    title: "Scan live windows",
    body: "Pull DreamDEX binary Event Contracts on Shannon, prefer BTC 15m, gate on on-chain Trading.",
  },
  {
    title: "Compute fair Up",
    body: "Map spot vs window reference into a fair Up probability. Transparent bias curve, no ML.",
  },
  {
    title: "Measure the edge",
    body: "edge = fair Up - book mid. Trade only when |edge| clears your threshold.",
  },
  {
    title: "Cross, copy, claim",
    body: "IOC when edged. One-tap copy of the agent fill. Redeem when the oracle settles.",
  },
];

const CAPABILITIES = [
  {
    title: "Explainable agent",
    body: "Every signal ships a plain-English why: spot move, fair Up, book mid, and the edge math.",
    icon: Lightning,
    wide: true,
  },
  {
    title: "Copy trade",
    body: "Mirror the last agent side with a single tap. Same IOC discipline, same market gate.",
    icon: CopySimple,
    wide: false,
  },
  {
    title: "Claim and settle",
    body: "Scan finalized markets, surface claimable balances, redeem winners and voided halves.",
    icon: SealCheck,
    wide: false,
  },
  {
    title: "Oracle trust",
    body: "Jump straight to the Somnia oracle resolution graph for the active question id.",
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
          <span className="flex h-8 w-8 items-center justify-center rounded-desk-sm border border-desk-accent/30 bg-desk-accent/10 font-mono text-sm font-semibold text-desk-accent">
            ed
          </span>
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
        {/* Asymmetric hero */}
        <section className="grid min-h-[calc(100dvh-4rem)] gap-10 pb-16 pt-10 md:grid-cols-[1.15fr_0.85fr] md:items-center md:gap-12 md:pb-20 md:pt-8">
          <motion.div {...fade(0)}>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-desk-border bg-desk-panel/80 px-3 py-1 text-[11px] font-medium text-desk-muted">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-desk-accent" />
              Event Contracts on Shannon
            </p>
            <h1 className="max-w-xl text-4xl font-semibold leading-[1.08] tracking-tight text-balance text-desk-ink sm:text-5xl lg:text-[3.35rem]">
              Fair Up vs the book.
              <span className="mt-1 block text-desk-accent">Trade the gap.</span>
            </h1>
            <p className="mt-5 max-w-[36ch] text-base leading-relaxed text-desk-muted sm:text-lg">
              Rule-based edge for DreamDEX binary windows. Spot moves first;
              the desk only crosses when mid lags, with a plain reason every
              time.
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
                Source
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
                    {live.dryRun ? "DRY" : "LIVE"} · {live.network}
                  </span>
                ) : (
                  <span className="rounded-full border border-desk-border px-2.5 py-0.5 text-[11px] text-desk-muted">
                    offline
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <HeroStat label="Asset" value={live?.signal?.asset || "BTC"} />
                <HeroStat
                  label="Last edge"
                  value={edgeLabel || "-"}
                  accent={edge != null && Math.abs(edge) >= 0.05}
                />
                <HeroStat
                  label="Up mid"
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
                  "Agent status unavailable. Desk still launches locally."}
              </p>
            </div>
          </motion.div>
        </section>

        {/* How it works - horizontal process, no numbered eyebrows */}
        <section className="pb-20">
          <h2 className="max-w-xl text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            Four steps. Zero black boxes.
          </h2>
          <p className="mt-2 max-w-[55ch] text-sm text-desk-muted sm:text-base">
            From live windows to redeemable outcomes, every step is readable
            math you can audit in the desk UI.
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

        {/* Why edge - split editorial */}
        <section className="pb-20">
          <div className="overflow-hidden rounded-desk-lg border border-desk-border bg-desk-panel">
            <div className="grid md:grid-cols-[0.9fr_1.1fr]">
              <div className="border-b border-desk-border bg-desk-accent/[0.06] p-6 md:border-b-0 md:border-r md:p-10">
                <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                  Books quote a probability. Spot moves first.
                </h2>
              </div>
              <div className="space-y-4 p-6 text-sm leading-relaxed text-desk-muted md:p-10 md:text-base">
                <p>
                  DreamDEX Event Contracts are short Up/Down windows on BTC or
                  ETH. The Up token trades between 0 and 1, a market-implied
                  probability the asset finishes above the window reference.
                </p>
                <p>
                  When spot drifts above or below that reference faster than the
                  book reprices, fair Up and mid diverge. That gap is the edge.
                  Edge Desk only fires when it clears your threshold, and always
                  tells you why.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Capabilities - asymmetric bento, not 3 equal cards */}
        <section className="pb-20">
          <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            Built for the desk, not the demo reel.
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

        {/* Stack strip */}
        <section className="pb-16">
          <p className="mb-3 text-sm text-desk-muted">Runs on</p>
          <div className="flex flex-wrap gap-2">
            {[
              "Somnia Shannon",
              "DreamDEX Event Contracts",
              "markets-sdk",
              "Next.js",
              "viem",
              "IOC fills",
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
              App
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
