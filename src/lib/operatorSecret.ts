/** Client-visible operator secret for local demo (must match server EDGE_DESK_SECRET). */
export function getClientOperatorSecret(): string | undefined {
  const s = process.env.NEXT_PUBLIC_EDGE_DESK_SECRET;
  if (!s || !s.trim()) return undefined;
  return s.trim();
}

export function hasClientOperatorSecret(): boolean {
  return Boolean(getClientOperatorSecret());
}

/** Headers for pause / focus / tick when the public demo secret is configured. */
export function operatorFetchHeaders(
  extra?: Record<string, string>,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extra,
  };
  const secret = getClientOperatorSecret();
  if (secret) headers["x-edge-desk-secret"] = secret;
  return headers;
}
