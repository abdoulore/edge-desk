import { getConfig } from "./config";

/** Require x-edge-desk-secret when EDGE_DESK_SECRET is configured. */
export function requireDeskSecret(req: Request): { ok: true } | { ok: false; status: number; message: string } {
  const cfg = getConfig();
  if (!cfg.edgeDeskSecret) {
    return {
      ok: false,
      status: 403,
      message:
        "Server custodial mutations are disabled. Connect your Shannon wallet and trade client-side.",
    };
  }
  const header = req.headers.get("x-edge-desk-secret") || "";
  if (header !== cfg.edgeDeskSecret) {
    return { ok: false, status: 401, message: "Unauthorized — missing or invalid x-edge-desk-secret" };
  }
  return { ok: true };
}
