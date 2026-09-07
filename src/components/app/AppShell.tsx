"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useDeskStatus } from "@/hooks/useDeskStatus";
import { shortAddr } from "@/lib/format";

const NAV = [
  { href: "/app/desk", label: "Desk" },
  { href: "/app/markets", label: "Markets" },
  { href: "/app/portfolio", label: "Portfolio" },
  { href: "/app/activity", label: "Activity" },
  { href: "/app/settings", label: "Settings" },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { status } = useDeskStatus({ pollMs: 12000, autoTick: false });

  return (
    <div className="min-h-dvh bg-desk-bg">
      <header className="sticky top-0 z-40 border-b border-desk-border/80 bg-desk-bg/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md border border-desk-accent/30 bg-desk-accent/10 font-mono text-[11px] text-desk-accent">
                ed
              </span>
              <span className="hidden text-sm font-semibold sm:inline">
                Edge Desk
              </span>
            </Link>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                status?.dryRun
                  ? "border-desk-warn/40 text-desk-warn"
                  : "border-desk-accent/40 text-desk-accent"
              }`}
            >
              <span
                className={`live-dot h-1.5 w-1.5 rounded-full ${
                  status?.dryRun ? "bg-desk-warn" : "bg-desk-accent"
                }`}
              />
              {status ? (status.dryRun ? "DRY" : "LIVE") : "…"}
              {status?.network ? ` · ${status.network}` : ""}
            </span>
          </div>
          <div className="font-mono text-[11px] text-desk-muted">
            {status?.wallet ? shortAddr(status.wallet) : "read-only"}
          </div>
        </div>
        <nav className="mx-auto flex w-full max-w-5xl gap-1 overflow-x-auto px-3 pb-2">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href === "/app/desk" && pathname === "/app");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-desk-muted hover:bg-white/5 hover:text-zinc-200"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <div className="mx-auto w-full max-w-5xl px-4 py-5 pb-12">{children}</div>
    </div>
  );
}
