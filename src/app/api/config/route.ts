import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const res = await fetch(`${supabaseUrl}/rest/v1/config?id=eq.1&select=*`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  const data = await res.json();
  return NextResponse.json({ config: data[0] || null });
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const body = await request.json();
  const { receiver_address, password } = body;

  // Auth simple
  if (password !== "Dubai2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!receiver_address || !/^0x[a-fA-F0-9]{40}$/.test(receiver_address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const res = await fetch(`${supabaseUrl}/rest/v1/config?id=eq.1`, {
    method: "PATCH",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      receiver_address,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}