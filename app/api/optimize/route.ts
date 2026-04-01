/**
 * app/api/optimize/route.ts
 * Next.js proxy route — forwards /api/optimize requests to the Railway FastAPI service.
 * The RAILWAY_API_KEY is never exposed to the browser.
 */

import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { tickers } = await request.json();

  const railwayUrl = process.env.RAILWAY_URL;
  const railwayApiKey = process.env.RAILWAY_API_KEY;

  if (!railwayUrl || !railwayApiKey) {
    return NextResponse.json(
      { error: { code: "CONFIG_ERROR", message: "Railway service not configured" } },
      { status: 500 }
    );
  }

  const response = await fetch(`${railwayUrl}/optimize`, {
    method: "POST",
    headers: {
      "X-API-Key": railwayApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tickers }),
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
