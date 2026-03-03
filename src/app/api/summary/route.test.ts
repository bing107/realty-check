/**
 * @jest-environment node
 */
import { POST } from './route';
import { NextRequest } from 'next/server';

jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn(),
      },
    })),
  };
});

const MockAnthropic = jest.requireMock('@anthropic-ai/sdk').default;

const validAnalysis = {
  property: { address: 'Musterstr. 12, 10115 Berlin', sqm: 75, units: 12, yearBuilt: 1985, type: 'ETW' },
  financials: {
    purchasePrice: 250000, hausgeld: 350, ruecklage: 50,
    currentRent: 800, expectedRent: 900,
    grunderwerbsteuer: 15000, notarFees: 5000, maklerFees: 8000,
  },
  protocols: { upcomingRenovations: [], sonderumlagen: [], maintenanceBacklog: [], disputes: [] },
  wirtschaftsplan: { annualBudget: 42000, reserveFundStatus: 'adequate', plannedMajorWorks: [] },
  redFlags: ['Low reserve fund'],
  summary: 'Decent investment opportunity.',
};

const validMetrics = {
  grossRentalYield: 4.32,
  netRentalYield: 2.37,
  totalAcquisitionCost: 278000,
  monthlyMortgagePayment: 926.13,
  monthlyCashFlow: -376.13,
  pricePerSqm: 3333.33,
  renovationReserveAdequacy: { adequate: true, message: 'Monthly reserve of 50 EUR with no upcoming renovations or maintenance backlog.' },
  breakEvenYears: null,
  assumptions: { mortgageRate: 0.035, downPayment: 0.20, loanTermYears: 25 },
};

const validClaudeResponse = {
  investmentSummary: 'This is a solid investment.\n\nHowever, the reserve fund is low.',
  priceComparison: {
    city: 'Berlin',
    areaAvgPerSqm: 4500,
    areaMinPerSqm: 3000,
    areaMaxPerSqm: 6000,
  },
};

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/summary', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/summary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('returns investmentSummary and priceComparison on valid request', async () => {
    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(validClaudeResponse) }],
    });
    MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

    const res = await POST(makeRequest({ analysis: validAnalysis, metrics: validMetrics }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.investmentSummary).toBe(validClaudeResponse.investmentSummary);
    expect(body.priceComparison).toEqual(validClaudeResponse.priceComparison);
  });

  it('returns 400 when body is missing', async () => {
    const req = new NextRequest('http://localhost/api/summary', {
      method: 'POST',
      body: 'not-json{{{',
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/analysis and metrics/);
  });

  it('returns 400 when analysis is missing', async () => {
    const res = await POST(makeRequest({ metrics: validMetrics }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/analysis and metrics/);
  });

  it('returns 400 when metrics is missing', async () => {
    const res = await POST(makeRequest({ analysis: validAnalysis }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/analysis and metrics/);
  });

  it('returns 500 when ANTHROPIC_API_KEY is not configured', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await POST(makeRequest({ analysis: validAnalysis, metrics: validMetrics }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/ANTHROPIC_API_KEY/);
  });

  it('returns 500 when Claude API call throws', async () => {
    const mockCreate = jest.fn().mockRejectedValue(new Error('API rate limit exceeded'));
    MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

    await expect(
      POST(makeRequest({ analysis: validAnalysis, metrics: validMetrics })),
    ).rejects.toThrow('API rate limit exceeded');
  });

  it('returns 500 when Claude returns invalid JSON text', async () => {
    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'This is not valid JSON at all' }],
    });
    MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

    const res = await POST(makeRequest({ analysis: validAnalysis, metrics: validMetrics }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/Failed to parse/);
    expect(body.raw).toBe('This is not valid JSON at all');
  });

  it('strips markdown code fences from Claude response', async () => {
    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: '```json\n' + JSON.stringify(validClaudeResponse) + '\n```' }],
    });
    MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

    const res = await POST(makeRequest({ analysis: validAnalysis, metrics: validMetrics }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.investmentSummary).toBe(validClaudeResponse.investmentSummary);
  });

  it('returns 500 when Claude returns non-text content type', async () => {
    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: 'tool_use', id: 'tool_1', name: 'some_tool', input: {} }],
    });
    MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

    const res = await POST(makeRequest({ analysis: validAnalysis, metrics: validMetrics }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/Unexpected response/);
  });
});
