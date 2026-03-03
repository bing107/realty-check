/** @jest-environment node */
import { POST } from './route';
import { NextRequest } from 'next/server';
import { DEFAULT_ASSUMPTIONS } from '@/lib/calculator';

const validAnalysis = {
  property: {
    address: 'Musterstraße 42, 10115 Berlin',
    sqm: 75,
    units: 12,
    yearBuilt: 1985,
    type: 'ETW',
  },
  financials: {
    purchasePrice: 250000,
    hausgeld: 350,
    ruecklage: 50,
    currentRent: 800,
    expectedRent: 900,
    grunderwerbsteuer: 15000,
    notarFees: 5000,
    maklerFees: 8000,
  },
  protocols: {
    upcomingRenovations: [],
    sonderumlagen: [],
    maintenanceBacklog: [],
    disputes: [],
  },
  wirtschaftsplan: {
    annualBudget: 42000,
    reserveFundStatus: 'adequate',
    plannedMajorWorks: [],
  },
  redFlags: ['Low reserve fund'],
  summary: 'Decent investment opportunity.',
};

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/calculate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/calculate', () => {
  it('returns 400 when analysis is missing', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/analysis/i);
  });

  it('returns 400 when request body is invalid JSON', async () => {
    const req = new NextRequest('http://localhost/api/calculate', {
      method: 'POST',
      body: 'not-json{{{',
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when analysis is missing nested objects', async () => {
    const res = await POST(makeRequest({ analysis: { financials: {} } }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/malformed/i);
  });

  it('returns 200 with valid analysis and computed metrics', async () => {
    const res = await POST(makeRequest({ analysis: validAnalysis }));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.metrics).toBeDefined();
    expect(body.metrics.grossRentalYield).toBeCloseTo(4.32, 2);
    expect(body.metrics.totalAcquisitionCost).toBe(278000);
    expect(body.metrics.assumptions).toEqual(DEFAULT_ASSUMPTIONS);
    expect(body.metrics.pricePerSqm).toBeCloseTo(3333.33, 2);
    expect(body.metrics.renovationReserveAdequacy).toBeDefined();
    expect(body.metrics.renovationReserveAdequacy.adequate).toBe(true);
  });

  it('accepts custom assumptions', async () => {
    const res = await POST(
      makeRequest({
        analysis: validAnalysis,
        assumptions: { mortgageRate: 0.04, downPayment: 0.30 },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.metrics.assumptions.mortgageRate).toBe(0.04);
    expect(body.metrics.assumptions.downPayment).toBe(0.30);
    expect(body.metrics.assumptions.loanTermYears).toBe(25);
  });
});
