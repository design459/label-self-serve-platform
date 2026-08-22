import { NextRequest, NextResponse } from "next/server";

// TEMPORARY — diagnosing why the rate limiter's IP detection collapses
// distinct visitors into one bucket. Delete this route once fixed.
export async function GET(req: NextRequest) {
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return NextResponse.json({ headers, nextUrlIp: (req as any).ip ?? null });
}
