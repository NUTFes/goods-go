import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseHealthUrl = process.env.SUPABASE_HEALTH_URL;

  if (!supabaseHealthUrl) {
    return NextResponse.json({ status: "error", supabase: "not_configured" }, { status: 503 });
  }

  try {
    const response = await fetch(supabaseHealthUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    });

    if (!response.ok) {
      return NextResponse.json({ status: "error", supabase: "unhealthy" }, { status: 503 });
    }
  } catch {
    return NextResponse.json({ status: "error", supabase: "unreachable" }, { status: 503 });
  }

  return NextResponse.json({ status: "ok", supabase: "ok" });
}
