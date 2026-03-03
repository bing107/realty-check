import { NextRequest, NextResponse } from 'next/server';
import { lookupCityData, computePercentile } from '@/lib/market-data';

// ---------------------------------------------------------------------------
// Response type
// ---------------------------------------------------------------------------

interface ComparisonResult {
  pricePerSqm: number;
  avgPricePerSqm: number;
  minPricePerSqm: number;
  maxPricePerSqm: number;
  percentile: number;
  priceTrend: 'rising' | 'stable' | 'falling';
  city: string;
}

// ---------------------------------------------------------------------------
// In-memory cache (1-hour TTL)
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 60 * 60 * 1000;

const cache = new Map<string, { result: ComparisonResult; expiresAt: number }>();

function getCached(key: string): ComparisonResult | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.result;
}

function setCache(key: string, result: ComparisonResult): void {
  cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ---------------------------------------------------------------------------
// POST /api/compare
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: 'Request body is required' }, { status: 400 });
  }

  const { address, price, sqm } = body;

  // Validate address
  if (typeof address !== 'string' || address.trim() === '') {
    return NextResponse.json({ error: 'address must be a non-empty string' }, { status: 400 });
  }

  // Validate price
  if (typeof price !== 'number' || !isFinite(price) || price <= 0) {
    return NextResponse.json({ error: 'price must be a number greater than 0' }, { status: 400 });
  }

  // Validate sqm
  if (typeof sqm !== 'number' || !isFinite(sqm) || sqm <= 0) {
    return NextResponse.json({ error: 'sqm must be a number greater than 0' }, { status: 400 });
  }

  // Cache lookup
  const cacheKey = `${address.toLowerCase().trim()}:${price}:${sqm}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  // Compute comparison
  const { data, matched } = lookupCityData(address);
  const pricePerSqm = Math.round((price / sqm) * 100) / 100;
  const percentile = computePercentile(pricePerSqm, data);

  const result: ComparisonResult = {
    pricePerSqm,
    avgPricePerSqm: data.avgPerSqm,
    minPricePerSqm: data.minPerSqm,
    maxPricePerSqm: data.maxPerSqm,
    percentile,
    priceTrend: data.priceTrend,
    city: matched,
  };

  setCache(cacheKey, result);

  return NextResponse.json(result);
}
