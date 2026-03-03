/**
 * German real estate market reference data and comparison utilities.
 * Pure TypeScript -- no external dependencies.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CityMarketData {
  city: string;
  avgPerSqm: number;
  minPerSqm: number;
  maxPerSqm: number;
  priceTrend: 'rising' | 'stable' | 'falling';
  stdDev: number;
}

// ---------------------------------------------------------------------------
// Market data (2024 German cities, EUR/m²)
// ---------------------------------------------------------------------------

export const CITY_MARKET_DATA: Record<string, CityMarketData> = {
  münchen: { city: 'München', avgPerSqm: 9500, minPerSqm: 6000, maxPerSqm: 16000, priceTrend: 'rising', stdDev: 2000 },
  berlin: { city: 'Berlin', avgPerSqm: 5800, minPerSqm: 3000, maxPerSqm: 10000, priceTrend: 'stable', stdDev: 1500 },
  hamburg: { city: 'Hamburg', avgPerSqm: 6800, minPerSqm: 4000, maxPerSqm: 11000, priceTrend: 'rising', stdDev: 1600 },
  frankfurt: { city: 'Frankfurt', avgPerSqm: 7200, minPerSqm: 4500, maxPerSqm: 12000, priceTrend: 'rising', stdDev: 1700 },
  köln: { city: 'Köln', avgPerSqm: 5500, minPerSqm: 3200, maxPerSqm: 9000, priceTrend: 'stable', stdDev: 1400 },
  stuttgart: { city: 'Stuttgart', avgPerSqm: 6200, minPerSqm: 4000, maxPerSqm: 10000, priceTrend: 'rising', stdDev: 1500 },
  düsseldorf: { city: 'Düsseldorf', avgPerSqm: 5900, minPerSqm: 3500, maxPerSqm: 9500, priceTrend: 'stable', stdDev: 1400 },
  dortmund: { city: 'Dortmund', avgPerSqm: 3200, minPerSqm: 1800, maxPerSqm: 5500, priceTrend: 'stable', stdDev: 800 },
  essen: { city: 'Essen', avgPerSqm: 2800, minPerSqm: 1600, maxPerSqm: 5000, priceTrend: 'stable', stdDev: 700 },
  leipzig: { city: 'Leipzig', avgPerSqm: 4200, minPerSqm: 2500, maxPerSqm: 7000, priceTrend: 'rising', stdDev: 1000 },
  dresden: { city: 'Dresden', avgPerSqm: 4000, minPerSqm: 2300, maxPerSqm: 6500, priceTrend: 'rising', stdDev: 900 },
  hannover: { city: 'Hannover', avgPerSqm: 3800, minPerSqm: 2200, maxPerSqm: 6500, priceTrend: 'stable', stdDev: 900 },
  nürnberg: { city: 'Nürnberg', avgPerSqm: 4500, minPerSqm: 2800, maxPerSqm: 7500, priceTrend: 'rising', stdDev: 1100 },
  bremen: { city: 'Bremen', avgPerSqm: 3500, minPerSqm: 2000, maxPerSqm: 6000, priceTrend: 'stable', stdDev: 900 },
  duisburg: { city: 'Duisburg', avgPerSqm: 2500, minPerSqm: 1400, maxPerSqm: 4500, priceTrend: 'stable', stdDev: 700 },
  bochum: { city: 'Bochum', avgPerSqm: 2900, minPerSqm: 1700, maxPerSqm: 5000, priceTrend: 'stable', stdDev: 700 },
  wuppertal: { city: 'Wuppertal', avgPerSqm: 2600, minPerSqm: 1500, maxPerSqm: 4500, priceTrend: 'falling', stdDev: 700 },
  bielefeld: { city: 'Bielefeld', avgPerSqm: 3000, minPerSqm: 1800, maxPerSqm: 5200, priceTrend: 'stable', stdDev: 700 },
  bonn: { city: 'Bonn', avgPerSqm: 4800, minPerSqm: 3000, maxPerSqm: 8000, priceTrend: 'rising', stdDev: 1100 },
  mannheim: { city: 'Mannheim', avgPerSqm: 4000, minPerSqm: 2400, maxPerSqm: 7000, priceTrend: 'stable', stdDev: 900 },
  karlsruhe: { city: 'Karlsruhe', avgPerSqm: 4200, minPerSqm: 2600, maxPerSqm: 7500, priceTrend: 'stable', stdDev: 1000 },
  freiburg: { city: 'Freiburg', avgPerSqm: 5500, minPerSqm: 3500, maxPerSqm: 9000, priceTrend: 'rising', stdDev: 1200 },
  augsburg: { city: 'Augsburg', avgPerSqm: 5000, minPerSqm: 3200, maxPerSqm: 8500, priceTrend: 'rising', stdDev: 1100 },
  wiesbaden: { city: 'Wiesbaden', avgPerSqm: 5800, minPerSqm: 3500, maxPerSqm: 9500, priceTrend: 'stable', stdDev: 1300 },
  münster: { city: 'Münster', avgPerSqm: 4500, minPerSqm: 2800, maxPerSqm: 7500, priceTrend: 'rising', stdDev: 1000 },
  mönchengladbach: { city: 'Mönchengladbach', avgPerSqm: 2800, minPerSqm: 1600, maxPerSqm: 5000, priceTrend: 'stable', stdDev: 700 },
  gelsenkirchen: { city: 'Gelsenkirchen', avgPerSqm: 2200, minPerSqm: 1200, maxPerSqm: 4000, priceTrend: 'falling', stdDev: 600 },
  aachen: { city: 'Aachen', avgPerSqm: 3500, minPerSqm: 2000, maxPerSqm: 6000, priceTrend: 'stable', stdDev: 800 },
  kiel: { city: 'Kiel', avgPerSqm: 3200, minPerSqm: 1900, maxPerSqm: 5500, priceTrend: 'stable', stdDev: 800 },
  magdeburg: { city: 'Magdeburg', avgPerSqm: 2800, minPerSqm: 1600, maxPerSqm: 4800, priceTrend: 'rising', stdDev: 700 },
  erfurt: { city: 'Erfurt', avgPerSqm: 3000, minPerSqm: 1800, maxPerSqm: 5200, priceTrend: 'rising', stdDev: 700 },
  rostock: { city: 'Rostock', avgPerSqm: 3500, minPerSqm: 2000, maxPerSqm: 6000, priceTrend: 'rising', stdDev: 900 },
  mainz: { city: 'Mainz', avgPerSqm: 5200, minPerSqm: 3200, maxPerSqm: 8500, priceTrend: 'rising', stdDev: 1200 },
  heidelberg: { city: 'Heidelberg', avgPerSqm: 6000, minPerSqm: 3800, maxPerSqm: 10000, priceTrend: 'rising', stdDev: 1400 },
  regensburg: { city: 'Regensburg', avgPerSqm: 5500, minPerSqm: 3400, maxPerSqm: 9000, priceTrend: 'rising', stdDev: 1200 },
  ingolstadt: { city: 'Ingolstadt', avgPerSqm: 5800, minPerSqm: 3600, maxPerSqm: 9500, priceTrend: 'rising', stdDev: 1300 },
  ulm: { city: 'Ulm', avgPerSqm: 4800, minPerSqm: 3000, maxPerSqm: 8000, priceTrend: 'stable', stdDev: 1100 },
  default: { city: 'Deutschland (Durchschnitt)', avgPerSqm: 4000, minPerSqm: 2000, maxPerSqm: 8000, priceTrend: 'stable', stdDev: 1200 },
};

// ---------------------------------------------------------------------------
// Alias map: alternative name -> canonical key in CITY_MARKET_DATA
// ---------------------------------------------------------------------------

const CITY_ALIASES: Record<string, string> = {
  munich: 'münchen',
  cologne: 'köln',
  nurnberg: 'nürnberg',
  'frankfurt am main': 'frankfurt',
};

// ---------------------------------------------------------------------------
// Normal CDF approximation (Abramowitz & Stegun)
// ---------------------------------------------------------------------------

function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422820 * Math.exp(-0.5 * z * z);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.8212560 + t * 1.3302744))));
  return z >= 0 ? 1 - p : p;
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * Look up market data for the city found in the given address string.
 * Uses substring matching against known city names and aliases.
 * Returns the default (national average) if no city matches.
 */
export function lookupCityData(address: string): { data: CityMarketData; matched: string } {
  const normalized = address.toLowerCase().trim();

  // Check canonical city keys (longest first to avoid partial matches like "essen" in "gelsenkirchen")
  const canonicalKeys = Object.keys(CITY_MARKET_DATA).filter((k) => k !== 'default');
  canonicalKeys.sort((a, b) => b.length - a.length);

  for (const key of canonicalKeys) {
    if (normalized.includes(key)) {
      const data = CITY_MARKET_DATA[key];
      return { data, matched: data.city };
    }
  }

  // Check aliases
  const aliasKeys = Object.keys(CITY_ALIASES);
  aliasKeys.sort((a, b) => b.length - a.length);

  for (const alias of aliasKeys) {
    if (normalized.includes(alias)) {
      const canonicalKey = CITY_ALIASES[alias];
      const data = CITY_MARKET_DATA[canonicalKey];
      return { data, matched: data.city };
    }
  }

  // Fallback to national average
  const fallback = CITY_MARKET_DATA['default'];
  return { data: fallback, matched: fallback.city };
}

/**
 * Compute the percentile of a given price/m² within a city's distribution.
 * Uses the normal CDF approximation. Result is clamped to [0, 100] and
 * rounded to 1 decimal place.
 */
export function computePercentile(pricePerSqm: number, data: CityMarketData): number {
  const z = (pricePerSqm - data.avgPerSqm) / data.stdDev;
  const raw = normalCDF(z) * 100;
  const clamped = Math.max(0, Math.min(100, raw));
  return Math.round(clamped * 10) / 10;
}
