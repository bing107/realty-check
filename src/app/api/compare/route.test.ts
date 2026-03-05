/** @jest-environment node */
import { POST } from './route';
import { NextRequest } from 'next/server';
import { lookupCityData } from '../../../lib/market-data';

jest.mock('../../../lib/market-data', () => {
  const actual = jest.requireActual('../../../lib/market-data');
  return { ...actual, lookupCityData: jest.fn(actual.lookupCityData) };
});

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/compare', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/compare', () => {
  // 1. Returns 400 when body is missing
  it('returns 400 when body is missing', async () => {
    const req = new NextRequest('http://localhost/api/compare', {
      method: 'POST',
      body: null,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  // 2. Returns 400 when address is empty string
  it('returns 400 when address is empty string', async () => {
    const res = await POST(makeRequest({ address: '', price: 300000, sqm: 75 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/address/i);
  });

  // 3. Returns 400 when price is 0 or negative
  it('returns 400 when price is 0 or negative', async () => {
    const res0 = await POST(makeRequest({ address: 'Berlin', price: 0, sqm: 75 }));
    expect(res0.status).toBe(400);

    const resNeg = await POST(makeRequest({ address: 'Berlin', price: -100, sqm: 75 }));
    expect(resNeg.status).toBe(400);
  });

  // 4. Returns 400 when sqm is 0 or negative
  it('returns 400 when sqm is 0 or negative', async () => {
    const res0 = await POST(makeRequest({ address: 'Berlin', price: 300000, sqm: 0 }));
    expect(res0.status).toBe(400);

    const resNeg = await POST(makeRequest({ address: 'Berlin', price: 300000, sqm: -10 }));
    expect(resNeg.status).toBe(400);
  });

  // 5. Returns 400 when price is not a number
  it('returns 400 when price is not a number', async () => {
    const res = await POST(makeRequest({ address: 'Berlin', price: 'abc', sqm: 75 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/price/i);
  });

  // 6. Returns correct comparison for München
  it('returns correct comparison for München', async () => {
    const res = await POST(makeRequest({ address: 'Musterstraße 10, München', price: 712500, sqm: 75 }));
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.avgPricePerSqm).toBe(9500);
    expect(data.priceTrend).toBe('rising');
    expect(data.city).toBe('München');
  });

  // 7. pricePerSqm equals price / sqm rounded to 2 decimals
  it('pricePerSqm equals price / sqm rounded to 2 decimals', async () => {
    const price = 500000;
    const sqm = 73;
    const expected = Math.round((price / sqm) * 100) / 100;

    const res = await POST(makeRequest({ address: 'Berlin', price, sqm }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.pricePerSqm).toBe(expected);
  });

  // 8. Percentile is ~50 when pricePerSqm ≈ avgPerSqm
  it('percentile is approximately 50 when pricePerSqm equals city average', async () => {
    // Berlin avg is 5800, so 5800 * 75 = 435000
    const res = await POST(makeRequest({ address: 'Berlin', price: 435000, sqm: 75 }));
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.percentile).toBeGreaterThan(45);
    expect(data.percentile).toBeLessThan(55);
  });

  // 9. Percentile > 50 when property is more expensive than average
  it('percentile is above 50 when property is more expensive than average', async () => {
    // Berlin avg is 5800/m², use price that gives ~8000/m²
    const res = await POST(makeRequest({ address: 'Berlin', price: 600000, sqm: 75 }));
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.percentile).toBeGreaterThan(50);
  });

  // 10. Percentile < 50 when property is cheaper than average
  it('percentile is below 50 when property is cheaper than average', async () => {
    // Berlin avg is 5800/m², use price that gives ~3000/m²
    const res = await POST(makeRequest({ address: 'Berlin', price: 225000, sqm: 75 }));
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.percentile).toBeLessThan(50);
  });

  // 11. Returns fallback data for unknown address
  it('returns fallback data for unknown address', async () => {
    const res = await POST(makeRequest({ address: 'Kleindorf am See 42', price: 200000, sqm: 80 }));
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.city).toBe('Deutschland (Durchschnitt)');
    expect(data.avgPricePerSqm).toBe(4000);
  });

  // 12. Cache returns same result on second call
  it('cache returns same result on second call with same inputs', async () => {
    const body = { address: 'Hamburg Altona', price: 510000, sqm: 75 };

    const res1 = await POST(makeRequest(body));
    expect(res1.status).toBe(200);
    const data1 = await res1.json();

    const res2 = await POST(makeRequest(body));
    expect(res2.status).toBe(200);
    const data2 = await res2.json();

    expect(data1).toEqual(data2);
  });

  // 13. Returns 400 for malformed JSON body
  it('returns 400 for malformed JSON body', async () => {
    const req = new NextRequest('http://localhost/api/compare', {
      method: 'POST',
      body: 'not-json{{{',
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  // 14. NaN becomes null via JSON.stringify, rejected by typeof !== 'number'
  it('returns 400 when price is NaN (serialized as null)', async () => {
    const res = await POST(makeRequest({ address: 'Berlin', price: NaN, sqm: 75 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/price/i);
  });

  // 15. Infinity becomes null via JSON.stringify, rejected by typeof !== 'number'
  it('returns 400 when price is Infinity (serialized as null)', async () => {
    const res = await POST(makeRequest({ address: 'Berlin', price: Infinity, sqm: 75 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/price/i);
  });

  // 16. NaN becomes null via JSON.stringify, rejected by typeof !== 'number'
  it('returns 400 when sqm is NaN (serialized as null)', async () => {
    const res = await POST(makeRequest({ address: 'Berlin', price: 300000, sqm: NaN }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/sqm/i);
  });

  // 17. Returns 400 when sqm is not a number (string)
  it('returns 400 when sqm is a string', async () => {
    const res = await POST(makeRequest({ address: 'Berlin', price: 300000, sqm: 'large' }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/sqm/i);
  });

  // 18. Returns 400 when address is null
  it('returns 400 when address is null', async () => {
    const res = await POST(makeRequest({ address: null, price: 300000, sqm: 75 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/address/i);
  });

  // 19. Returns 400 when address field is missing from body
  it('returns 400 when address field is missing from body', async () => {
    const res = await POST(makeRequest({ price: 300000, sqm: 75 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/address/i);
  });

  // 20. Address with only street and no city falls back to national average
  it('falls back to national average for street-only address with no city', async () => {
    const res = await POST(makeRequest({ address: 'Hauptstraße 42', price: 300000, sqm: 75 }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.city).toBe('Deutschland (Durchschnitt)');
  });

  // 21. PLZ-only address falls back to national average (no PLZ lookup implemented)
  it('falls back to national average for PLZ-only address (no PLZ lookup)', async () => {
    const res = await POST(makeRequest({ address: 'Musterstr. 1, 80331', price: 712500, sqm: 75 }));
    expect(res.status).toBe(200);
    const data = await res.json();
    // 80331 is a Munich PLZ but there is no PLZ-level lookup — should fall back
    expect(data.city).toBe('Deutschland (Durchschnitt)');
  });

  // 22. City substring false match: "Neuessen" should NOT match "Essen"
  it('matches "essen" in "Neuessen" due to substring matching (known limitation)', async () => {
    const res = await POST(makeRequest({ address: 'Am Markt 5, Neuessen', price: 200000, sqm: 80 }));
    expect(res.status).toBe(200);
    const data = await res.json();
    // This documents a known bug: substring matching causes false positives.
    // "Neuessen" contains "essen" so it incorrectly matches Essen.
    expect(data.city).toBe('Essen');
  });

  // 23. Percentile near 0 for extremely cheap property
  it('percentile approaches 0 for extremely low pricePerSqm', async () => {
    // Berlin avg=5800 stdDev=1500; price/sqm = 100000/75 = 1333 => z ~ -2.98
    const res = await POST(makeRequest({ address: 'Berlin', price: 100, sqm: 75 }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.percentile).toBeLessThanOrEqual(1);
    expect(data.percentile).toBeGreaterThanOrEqual(0);
  });

  // 24. Percentile near 100 for extremely expensive property
  it('percentile approaches 100 for extremely high pricePerSqm', async () => {
    // Berlin avg=5800 stdDev=1500; price/sqm = 100000000/75 = 1333333 => z >> 5
    const res = await POST(makeRequest({ address: 'Berlin', price: 100000000, sqm: 75 }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.percentile).toBeGreaterThanOrEqual(99);
    expect(data.percentile).toBeLessThanOrEqual(100);
  });

  // 25. Cache TTL expiry: expired entries are not returned
  it('does not return expired cache entries', async () => {
    jest.useFakeTimers();
    const mock = lookupCityData as jest.Mock;
    mock.mockClear();
    try {
      const body = { address: 'Freiburg Altstadt', price: 412500, sqm: 75 };

      const res1 = await POST(makeRequest(body));
      expect(res1.status).toBe(200);
      expect(mock).toHaveBeenCalledTimes(1);

      // Advance time past the 1-hour TTL
      jest.advanceTimersByTime(60 * 60 * 1000 + 1);

      const res2 = await POST(makeRequest(body));
      expect(res2.status).toBe(200);
      // lookupCityData must be called again, proving the cache entry expired
      expect(mock).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  // 26. Returns 400 when address is whitespace-only
  it('returns 400 when address is whitespace-only', async () => {
    const res = await POST(makeRequest({ address: '   ', price: 300000, sqm: 75 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/address/i);
  });

  // 27. City alias "cologne" resolves to Köln
  it('resolves city alias "cologne" to Köln', async () => {
    const res = await POST(makeRequest({ address: 'Cologne Innenstadt', price: 412500, sqm: 75 }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.city).toBe('Köln');
    expect(data.avgPricePerSqm).toBe(5500);
  });

  // 28. -Infinity becomes null via JSON.stringify, rejected by typeof !== 'number'
  it('returns 400 when price is -Infinity (serialized as null)', async () => {
    const res = await POST(makeRequest({ address: 'Berlin', price: -Infinity, sqm: 75 }));
    expect(res.status).toBe(400);
  });

});
