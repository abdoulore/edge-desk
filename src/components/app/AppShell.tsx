"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  ChartLine,
  SquaresFour,
  Wallet,
  Pulse,
  GearSix,
} from "@phosphor-icons/react";
import { useDeskStatus } from "@/hooks/useDeskStatus";
import ConnectButton from "@/wallet/ConnectButton";
import BrandLogo from "@/components/BrandLogo";

const NAV = [
  { href: "/app/desk", label: "Desk", icon: ChartLine },
  { href: "/app/markets", label: "Markets", icon: SquaresFour },
  { href: "/app/portfolio", label: "Portfolio", icon: Wallet },
  { href: "/app/activity", label: "Activity", icon: Pulse },
  { href: "/app/settings", label: "Settings", icon: GearSix },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { status } = useDeskStatus({ pollMs: 12000, autoTick: false });

  const modeLabel = status
    ? status.paused
      ? "PAUSED"
      : status.dryRun
        ? "SIGNAL"
        : "LIVE"
    : "...";

  return (
    <div className="min-h-dvh bg-desk-bg">
      <header className="sticky top-0 z-40 border-b border-desk-border/80 bg-desk-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" className="flex shrink-0 items-center gap-2.5">
              <BrandLogo size={28} />
              <span className="hidden text-sm font-semibold tracking-tight sm:inline">
                Edge Desk
              </span>
            </Link>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                status?.paused
                  ? "border-desk-warn/40 text-desk-warn"
                  : status?.dryRun
                    ? "border-desk-warn/40 text-desk-warn"
                    : "border-desk-accent/40 text-desk-accent"
              }`}
            >
              <span
                className={`live-dot h-1.5 w-1.5 rounded-full ${
                  status?.paused || status?.dryRun
                    ? "bg-desk-warn"
                    : "bg-desk-accent"
                }`}
              />
              {modeLabel}
              {status?.network ? (
                <span className="hidden text-desk-muted sm:inline">
                  {" "}
                  · {status.network}
                </span>
              ) : null}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {status?.agentStalled && (
              <span className="hidden rounded-full border border-desk-down/40 px-2 py-0.5 text-[10px] text-desk-down md:inline">
                agent stale
              </span>
            )}
            <ConnectButton />
          </div>
        </div>
        <nav className="mx-auto flex h-11 w-full max-w-6xl items-center gap-0.5 overflow-x-auto px-3 pb-2">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href === "/app/desk" && pathname === "/app");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-desk-sm px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-desk-muted hover:bg-white/5 hover:text-desk-ink"
                }`}
              >
                <Icon
                  size={15}
                  weight={active ? "fill" : "regular"}
                  className="opacity-80"
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <div className="mx-auto w-full max-w-6xl px-4 py-5 pb-14">{children}</div>
    </div>
  );
}
