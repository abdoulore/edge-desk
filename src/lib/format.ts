export function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return `${(n * 100).toFixed(digits)}%`;
}

export function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return n.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

export function fmtCountdown(expiry: number, nowMs = Date.now()): string {
  if (!expiry) return "-";
  const left = Math.max(0, Math.floor(expiry - nowMs / 1000));
  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function fmtInterval(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return "-";
  if (sec >= 86400) {
    const n = Math.round(sec / 86400);
    return `${n} day${n === 1 ? "" : "s"}`;
  }
  if (sec >= 3600) {
    const n = Math.round(sec / 3600);
    return `${n} hour${n === 1 ? "" : "s"}`;
  }
  const n = Math.round(sec / 60);
  return `${n} min`;
}

export function shortAddr(addr?: string | null, left = 6, right = 4): string {
  if (!addr) return "-";
  if (addr.length <= left + right + 1) return addr;
  return `${addr.slice(0, left)}…${addr.slice(-right)}`;
}

export function shortHash(hash?: string | null): string {
  return shortAddr(hash, 8, 6);
}

export function fmtTime(iso?: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "-";
  }
}

export function fmtDateTime(iso?: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}


/** Format a raw ERC-6909 / collateral integer with token decimals. */
export function formatRawBalance(
  raw: string | bigint | number | null | undefined,
  decimals = 6,
  maxFrac = 6,
): string {
  if (raw == null || raw === "") return "0";
  let n: bigint;
  try {
    n = typeof raw === "bigint" ? raw : BigInt(String(raw).split(".")[0] || "0");
  } catch {
    return String(raw);
  }
  const neg = n < 0n;
  const abs = neg ? -n : n;
  const d = Math.max(0, Math.min(36, Math.floor(decimals)));
  const base = 10n ** BigInt(d);
  const whole = abs / base;
  let frac = (abs % base).toString().padStart(d, "0");
  if (maxFrac < d) frac = frac.slice(0, maxFrac);
  frac = frac.replace(/0+$/, "");
  const s = frac ? `${whole.toString()}.${frac}` : whole.toString();
  return neg ? `-${s}` : s;
}
