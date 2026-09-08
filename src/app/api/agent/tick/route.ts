import { NextResponse } from "next/server";
import { runAgentTick } from "@/agent/tick";
import { requireDeskSecret } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Operator-only: run one agent tick. POST only — no mutating GET. */
export async function POST(req: Request) {
  const auth = requireDeskSecret(req);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: auth.message },
      { status: auth.status },
    );
  }
  try {
    const signal = await runAgentTick();
    return NextResponse.json({ ok: true, signal });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
