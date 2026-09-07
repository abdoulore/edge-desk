import { NextResponse } from "next/server";
import { runAgentTick } from "@/agent/tick";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
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

export async function GET() {
  return POST();
}
