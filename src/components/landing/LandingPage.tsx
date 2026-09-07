"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { DeskStatus } from "@/lib/types";
import { fmtPct, fmtTime } from "@/lib/format";

const GITHUB = "https://github.com/abdoulore/edge-desk";

const STEPS = [
  {
    n: "01",
    title: "Scan live windows",
    body: "Pull DreamDEX binary Event Contracts on Shannon, prefer BTC 15m, gate on on-chain Trading.",
  },
  {
    n: "02",
    title: "Compute fair Up",
    body: "Map spot vs window reference into a fair Up probability — no ML, just a transparent bias curve.",
  },
  {
    n: "03",
    title: "Measure the edge",
    body: "edge = fair Up − book mid. Trade only when |edge| clears your threshold.",
  },
  {
    n: "04",
    title: "Cross · copy · claim",
    body: "IOC when edged. One-tap copy of the agent fill. Redeem resolved outcomes when the oracle settles.",
  },
];

const FEATURES = [
  {
    title: "Explainable agent",
    body: "Every signal ships a plain-English why — spot move, fair Up, book mid, and the edge math.",
    icon: "◇",
  },
  {
    title: "Copy trade",
    body: "Mirror the last agent side with a single tap. Same IOC discipline, same market gate.",
    icon: "⇢",
  },
  {
    title: "Claim & settle",
    body: "Scan finalized markets, surface claimable balances, redeem winners (and voided halves).",
    icon: "▣",
  },
  {
    title: "Oracle trust",
    body: "Jump straight to the Somnia oracle resolution graph for the active question id.",
    icon: "◎",
  },
];

export default function LandingPage() {
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
    edge == null
      ? null
      : `${edge >= 0 ? "+" : ""}${fmtPct(edge)}`;

  return (
    <div className="landing-root relative min-h-dvh overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 landing-grid opacity-40" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[28rem] w-[48rem] -translate-x-1/2 rounded-full bg-desk-accent/10 blur-[100px]" />
      <div className="pointer-events-none absolute top-[40%] right-0 h-72 w-72 rounded-full bg-desk-cyan/10 blur-[90px]" />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 md:px-8">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-desk-accent/30 bg-desk-accent/10 font-mono text-sm text-desk-accent">
            ed
          </span>
          <div>
            <p className="text-sm font-semibold tracking-tight">Edge Desk</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-desk-muted">
              Somnia × DreamDEX
            </p>
          </div>
        </div>
        <nav className="flex items-center gap-2 sm:gap-3">
          <a
            href={GITHUB}
            target="_blank"
            rel="noreferrer"
            className="hidden rounded-full border border-desk-border px-3 py-1.5 text-xs text-desk-muted transition hover:border-desk-cyan/40 hover:text-desk-cyan sm:inline-flex"
          >
            GitHub
          </a>
          <Link
            href="/app/desk"
            className="rounded-full bg-desk-accent px-3.5 py-1.5 text-xs font-semibold text-black transition hover:bg-desk-accent/90"
          >
            Launch Desk
          </Link>
        </nav>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-20 md:px-8">
        {/* Hero */}
        <section className="grid gap-10 pb-16 pt-10 md:grid-cols-[1.2fr_0.8fr] md:items-center md:pb-24 md:pt-16">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-desk-border bg-desk-panel/80 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-desk-muted">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-desk-accent" />
              Hackathon · Event Contracts
            </p>
            <h1 className="max-w-xl text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl md:text-[3.25rem]">
              Explainable edge for{" "}
              <span className="bg-gradient-to-r from-desk-accent to-desk-cyan bg-clip-text text-transparent">
                binary Up/Down
              </span>{" "}
              windows.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-desk-muted sm:text-lg">
              Edge Desk watches DreamDEX Event Contracts on Shannon testnet,
              compares spot to the window reference, and only crosses when the
              book misprices fair Up — with a one-sentence reason every time.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/app/desk"
                className="inline-flex items-center justify-center rounded-xl bg-desk-accent px-5 py-3 text-sm font-semibold text-black shadow-lg shadow-desk-accent/20 transition hover:bg-desk-accent/90"
              >
                Launch Desk →
              </Link>
              <a
                href={GITHUB}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-xl border border-desk-border bg-desk-panel px-5 py-3 text-sm font-semibold text-white transition hover:border-desk-cyan/50 hover:text-desk-cyan"
              >
                View on GitHub
              </a>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-2xl border border-desk-border bg-desk-panel/90 p-5 shadow-2xl shadow-black/40 backdrop-blur">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.2em] text-desk-muted">
                  Live proof
                </p>
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
                <HeroStat
                  label="Asset"
                  value={live?.signal?.asset || "BTC"}
                />
                <HeroStat
                  label="Last edge"
                  value={edgeLabel || "—"}
                  accent={edge != null && Math.abs(edge) >= 0.05}
                />
                <HeroStat
                  label="Up mid"
                  value={
                    live?.signal?.upMid != null
                      ? fmtPct(live.signal.upMid)
                      : "—"
                  }
                />
                <HeroStat
                  label="Updated"
                  value={fmtTime(live?.signal?.updatedAt || live?.lastTickAt)}
                />
              </div>
              <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-zinc-300">
                {live?.signal?.reason ||
                  "Agent status unavailable — desk still launches locally."}
              </p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="pb-20">
          <SectionLabel>How it works</SectionLabel>
          <h2 className="mt-2 max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">
            Four steps. Zero black boxes.
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div
                key={s.n}
                className="rounded-2xl border border-desk-border bg-desk-panel/70 p-5 transition hover:border-desk-cyan/30"
              >
                <p className="font-mono text-xs text-desk-cyan">{s.n}</p>
                <h3 className="mt-2 text-base font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-desk-muted">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Why edge */}
        <section className="pb-20">
          <div className="grid gap-8 rounded-3xl border border-desk-border bg-gradient-to-br from-desk-panel to-desk-bg p-6 md:grid-cols-2 md:p-10">
            <div>
              <SectionLabel>Why edge / Event Contracts</SectionLabel>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                Books quote a probability. Spot moves first.
              </h2>
            </div>
            <div className="space-y-4 text-sm leading-relaxed text-desk-muted md:text-base">
              <p>
                DreamDEX Event Contracts are short Up/Down windows on BTC or ETH.
                The Up token trades between 0 and 1 — effectively a market-
                implied probability the asset finishes above the window
                reference.
              </p>
              <p>
                When spot drifts above (or below) that reference faster than the
                book reprices, fair Up and mid diverge. That gap is the edge.
                Edge Desk only fires when it clears your threshold — and always
                tells you why.
              </p>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="pb-20">
          <SectionLabel>Features</SectionLabel>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Built for the desk, not the demo reel.
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="flex gap-4 rounded-2xl border border-desk-border bg-desk-panel/60 p-5"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-desk-accent/20 bg-desk-accent/5 font-mono text-desk-accent">
                  {f.icon}
                </span>
                <div>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-desk-muted">
                    {f.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Stack */}
        <section className="pb-16">
          <SectionLabel>Built on</SectionLabel>
          <div className="mt-4 flex flex-wrap gap-2">
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
                className="rounded-full border border-desk-border bg-black/30 px-3.5 py-1.5 text-xs font-medium text-zinc-300"
              >
                {t}
              </span>
            ))}
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-desk-border/80 bg-black/30">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-desk-muted md:flex-row md:items-center md:justify-between md:px-8">
          <p>Edge Desk · Somnia × DreamDEX Event Contracts</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/app/desk" className="hover:text-desk-accent">
              App
            </Link>
            <a href={GITHUB} target="_blank" rel="noreferrer" className="hover:text-desk-cyan">
              GitHub
            </a>
            <a
              href="https://docs.dreamdex.io"
              target="_blank"
              rel="noreferrer"
              className="hover:text-desk-cyan"
            >
              DreamDEX docs
            </a>
            <a
              href="https://shannon-explorer.somnia.network"
              target="_blank"
              rel="noreferrer"
              className="hover:text-desk-cyan"
            >
              Shannon explorer
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-desk-cyan">
      {children}
    </p>
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
    <div className="rounded-xl border border-desk-border/80 bg-black/30 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-desk-muted">
        {label}
      </p>
      <p
        className={`mt-0.5 font-mono text-lg font-semibold tabular-nums ${
          accent ? "text-desk-accent" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
