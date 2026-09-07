import { NextResponse } from "next/server";
import { patchMeta } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { marketId?: string | null };
    const marketId =
      typeof body.marketId === "string" && body.marketId.trim()
        ? body.marketId.trim()
        : null;
    const meta = await patchMeta({ focusMarketId: marketId });
    return NextResponse.json({ ok: true, focusMarketId: meta.focusMarketId ?? null });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
