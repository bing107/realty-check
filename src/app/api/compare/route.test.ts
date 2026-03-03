/** @jest-environment node */
import { POST } from './route';
import { NextRequest } from 'next/server';

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
});
