import { NextResponse } from "next/server";
import { patchMeta } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { paused?: boolean };
    const paused = Boolean(body.paused);
    const meta = await patchMeta({ paused });
    return NextResponse.json({ ok: true, paused: Boolean(meta.paused) });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
