"use client";

import { useEffect, useState } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { shortAddr } from "@/lib/format";
import { SHANNON_CHAIN_ID } from "./config";

export default function ConnectButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <span className="rounded-lg border border-desk-border px-2.5 py-1 font-mono text-[11px] text-desk-muted">
        …
      </span>
    );
  }

  if (!isConnected || !address) {
    const connector = connectors[0];
    return (
      <button
        type="button"
        disabled={!connector || isPending}
        onClick={() => connector && connect({ connector })}
        className="rounded-lg border border-desk-accent/40 bg-desk-accent/10 px-2.5 py-1 text-[11px] font-medium text-desk-accent transition hover:bg-desk-accent/20 disabled:opacity-50"
        title={error?.message}
      >
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }

  const wrongChain = chainId !== SHANNON_CHAIN_ID;

  return (
    <div className="flex items-center gap-1.5">
      {wrongChain && (
        <button
          type="button"
          disabled={switching}
          onClick={() => switchChain({ chainId: SHANNON_CHAIN_ID })}
          className="rounded-lg border border-desk-warn/40 px-2 py-1 text-[11px] text-desk-warn"
        >
          {switching ? "Switching…" : "Switch to Shannon"}
        </button>
      )}
      <button
        type="button"
        onClick={() => disconnect()}
        className="rounded-lg border border-desk-border bg-black/30 px-2.5 py-1 font-mono text-[11px] text-zinc-200 hover:border-desk-cyan/40"
        title="Disconnect"
      >
        {shortAddr(address)}
      </button>
    </div>
  );
}
