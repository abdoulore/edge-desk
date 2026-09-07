"use client";

import { useEffect, useState } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { Wallet, ArrowsLeftRight } from "@phosphor-icons/react";
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
      <span className="inline-flex h-8 items-center rounded-desk-sm border border-desk-border px-2.5 font-mono text-[11px] text-desk-muted">
        ...
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
        className="inline-flex h-8 items-center gap-1.5 rounded-desk-sm border border-desk-accent/40 bg-desk-accent/10 px-2.5 text-[11px] font-medium text-desk-accent transition hover:bg-desk-accent/20 active:scale-[0.98] disabled:opacity-50"
        title={error?.message}
      >
        <Wallet size={13} weight="bold" />
        {isPending ? "Connecting..." : "Connect"}
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
          className="inline-flex h-8 items-center gap-1 rounded-desk-sm border border-desk-warn/40 px-2 text-[11px] text-desk-warn"
        >
          <ArrowsLeftRight size={12} />
          {switching ? "Switching..." : "Shannon"}
        </button>
      )}
      <button
        type="button"
        onClick={() => disconnect()}
        className="inline-flex h-8 items-center rounded-desk-sm border border-desk-border bg-black/30 px-2.5 font-mono text-[11px] text-desk-ink tabular hover:border-desk-accent/40"
        title="Disconnect"
      >
        {shortAddr(address)}
      </button>
    </div>
  );
}
