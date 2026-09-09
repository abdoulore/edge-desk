import { getConfig } from "./config";

/** Require x-edge-desk-secret when EDGE_DESK_SECRET is configured. */
export function requireDeskSecret(req: Request): { ok: true } | { ok: false; status: number; message: string } {
  const cfg = getConfig();
  if (!cfg.edgeDeskSecret) {
    return {
      ok: false,
      status: 403,
      message:
        "Manual server controls are unavailable on this deployment. Trade from your connected wallet instead.",
    };
  }
  const header = req.headers.get("x-edge-desk-secret") || "";
  if (header !== cfg.edgeDeskSecret) {
    return { ok: false, status: 401, message: "This control is unavailable on this deployment." };
  }
  return { ok: true };
}
