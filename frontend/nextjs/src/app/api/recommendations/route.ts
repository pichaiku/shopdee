import { NextResponse, type NextRequest } from "next/server";
import type { Product, RecommendedProduct } from "@/lib/types";

// Runs on the Next.js server, so it can reach the services by their internal URLs:
//   ML_BASE_URL  -> Flask recommendation service (e.g. http://flask:5000/api)
//   API_BASE_URL -> Express API                  (e.g. http://express:4000/api)
export const dynamic = "force-dynamic";

const LIMIT = 10;
const ML_BASE = process.env.ML_BASE_URL || "http://localhost:5000/api";
const API_BASE = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";

async function fetchJson<T>(url: string, timeoutMs = 6000): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    // pandas may emit NaN for NULL columns, which is not valid JSON
    const text = (await res.text()).replace(/\bNaN\b/g, "null");
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const custID = Number(request.nextUrl.searchParams.get("custID"));
  const hasUser = Number.isInteger(custID) && custID > 0;

  const [mlResult, popularResult] = await Promise.all([
    hasUser ? fetchJson<unknown>(`${ML_BASE}/recommend/${custID}`) : Promise.resolve(null),
    fetchJson<Product[]>(`${API_BASE}/product/popular?limit=${LIMIT * 2}`),
  ]);

  const popular = Array.isArray(popularResult) ? popularResult : [];
  const popularById = new Map(popular.map((p) => [Number(p.productID), p]));

  const items: RecommendedProduct[] = [];
  const seen = new Set<number>();

  // 1) ML recommendations for logged-in users (only when the service returned a list)
  if (Array.isArray(mlResult)) {
    for (const raw of mlResult as Product[]) {
      const id = Number(raw?.productID);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      // enrich with typeName / totalSold when we have it
      items.push({ ...raw, ...(popularById.get(id) ?? {}), source: "recommended" });
      if (items.length >= LIMIT) break;
    }
  }

  // 2) Fill up to 10 with best sellers (most ordered first)
  for (const p of popular) {
    if (items.length >= LIMIT) break;
    const id = Number(p.productID);
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({ ...p, source: "popular" });
  }

  return NextResponse.json({
    items,
    recommendedCount: items.filter((i) => i.source === "recommended").length,
  });
}
