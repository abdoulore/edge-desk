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
  if (sec >= 86400) return `${Math.round(sec / 86400)}d`;
  if (sec >= 3600) return `${Math.round(sec / 3600)}h`;
  return `${Math.round(sec / 60)}m`;
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
