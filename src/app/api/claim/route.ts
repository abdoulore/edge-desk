import { NextResponse } from "next/server";
import { claimMarket } from "@/agent/tick";
import { requireDeskSecret } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Custodial claim — disabled unless EDGE_DESK_SECRET matches. Prefer wallet Claim. */
export async function POST(req: Request) {
  const auth = requireDeskSecret(req);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: auth.message },
      { status: auth.status },
    );
  }
  try {
    const body = (await req.json().catch(() => ({}))) as { marketId?: string };
    if (!body.marketId) {
      return NextResponse.json(
        { ok: false, message: "marketId required" },
        { status: 400 },
      );
    }
    const result = await claimMarket(body.marketId);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
