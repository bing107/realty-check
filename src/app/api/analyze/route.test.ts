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

jest.mock('@/auth', () => ({
  auth: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/auth-config', () => ({
  isAuthEnabled: false,
  AUTH_ENABLED: false,
  STRIPE_ENABLED: false,
}));

jest.mock('@/lib/usage', () => ({
  canRunAnalysis: jest.fn().mockResolvedValue({ allowed: true }),
  incrementUsage: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/posthog-server', () => ({
  serverTrack: jest.fn().mockResolvedValue(undefined),
}));

const MockAnthropic = jest.requireMock('@anthropic-ai/sdk').default;
const { serverTrack } = jest.requireMock('@/lib/posthog-server') as { serverTrack: jest.Mock };
const { auth: mockAuth } = jest.requireMock('@/auth') as { auth: jest.Mock };
const mockAuthConfig = jest.requireMock('@/lib/auth-config') as { isAuthEnabled: boolean };
const { canRunAnalysis: mockCanRunAnalysis, incrementUsage: mockIncrementUsage } = jest.requireMock('@/lib/usage') as {
  canRunAnalysis: jest.Mock;
  incrementUsage: jest.Mock;
};

const validAnalysis = {
  property: { address: '123 Main St', sqm: 75, units: 12, yearBuilt: 1985, type: 'ETW' },
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

function makeRequest(body: unknown, headers?: Record<string, string>) {
  return new NextRequest('http://localhost/api/analyze', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...headers },
  });
}

describe('POST /api/analyze', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('returns 400 when request body is invalid JSON (covers req.json().catch callback)', async () => {
    const req = new NextRequest('http://localhost/api/analyze', {
      method: 'POST',
      body: 'not valid json {{{',
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when texts array is missing', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns 400 when texts array is empty', async () => {
    const res = await POST(makeRequest({ texts: [] }));
    expect(res.status).toBe(400);
  });

  it('returns 401 when no API key is provided', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await POST(makeRequest({ texts: [{ filename: 'doc.pdf', text: 'hello' }] }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/API key required/);
  });

  it('succeeds when API key is provided via X-API-Key header', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(validAnalysis) }],
    });
    MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

    const res = await POST(makeRequest(
      { texts: [{ filename: 'test.pdf', text: 'Extracted text' }] },
      { 'x-api-key': 'header-key-123' },
    ));
    expect(res.status).toBe(200);
    expect(MockAnthropic).toHaveBeenCalledWith({ apiKey: 'header-key-123' });
  });

  it('falls back to env var when no X-API-Key header is provided', async () => {
    process.env.ANTHROPIC_API_KEY = 'env-key-456';

    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(validAnalysis) }],
    });
    MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

    const res = await POST(makeRequest({ texts: [{ filename: 'doc.pdf', text: 'text' }] }));
    expect(res.status).toBe(200);
    expect(MockAnthropic).toHaveBeenCalledWith({ apiKey: 'env-key-456' });
  });

  it('returns structured analysis on success', async () => {
    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(validAnalysis) }],
    });
    MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

    const res = await POST(makeRequest({ texts: [{ filename: 'doc.pdf', text: 'Extracted text' }] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.analysis).toEqual(validAnalysis);
  });

  it('strips markdown code fences from Claude response', async () => {
    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: '```json\n' + JSON.stringify(validAnalysis) + '\n```' }],
    });
    MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

    const res = await POST(makeRequest({ texts: [{ filename: 'doc.pdf', text: 'text' }] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.analysis.redFlags).toEqual(['Low reserve fund']);
  });

  it('sends all document texts with correct separator format', async () => {
    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(validAnalysis) }],
    });
    MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

    const res = await POST(makeRequest({
      texts: [
        { filename: 'doc1.pdf', text: 'Text from first document' },
        { filename: 'doc2.pdf', text: 'Text from second document' },
      ],
    }));
    expect(res.status).toBe(200);

    const callArgs = mockCreate.mock.calls[0][0];
    const userContent = callArgs.messages[0].content;
    expect(userContent).toContain('--- DOCUMENT: doc1.pdf ---');
    expect(userContent).toContain('Text from first document');
    expect(userContent).toContain('--- DOCUMENT: doc2.pdf ---');
    expect(userContent).toContain('Text from second document');
  });

  it('returns 500 when Claude returns non-text content type', async () => {
    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: 'tool_use', id: 'tool_1', name: 'some_tool', input: {} }],
    });
    MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

    const res = await POST(makeRequest({ texts: [{ filename: 'doc.pdf', text: 'text' }] }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/Unexpected response/);
  });

  it('returns 500 when Claude returns invalid JSON text', async () => {
    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'This is not JSON at all' }],
    });
    MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

    const res = await POST(makeRequest({ texts: [{ filename: 'doc.pdf', text: 'text' }] }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/Failed to parse/);
    expect(body.raw).toBe('This is not JSON at all');
  });

  it('returns 500 when Claude API call throws', async () => {
    const mockCreate = jest.fn().mockRejectedValue(new Error('API rate limit exceeded'));
    MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

    const res = await POST(makeRequest({ texts: [{ filename: 'doc.pdf', text: 'text' }] }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/API rate limit exceeded/);
  });

  it('returns 500 with generic message when Claude throws non-Error (line 156)', async () => {
    const mockCreate = jest.fn().mockRejectedValue('string error');
    MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

    const res = await POST(makeRequest({ texts: [{ filename: 'doc.pdf', text: 'text' }] }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Claude API error');
  });

  describe('Auth and usage limits (lines 117-132, 138, 178-181)', () => {
    it('returns 403 when auth is enabled and usage limit is reached', async () => {
      Object.assign(mockAuthConfig, { isAuthEnabled: true });
      mockAuth.mockResolvedValue({ user: { id: 'user-123' } });
      mockCanRunAnalysis.mockResolvedValue({
        allowed: false,
        tier: 'free',
        used: 1,
        limit: 1,
      });

      const res = await POST(makeRequest({ texts: [{ filename: 'doc.pdf', text: 'text' }] }));
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe('limit_reached');
      expect(body.tier).toBe('free');
      expect(body.used).toBe(1);
      expect(body.limit).toBe(1);

      // Restore
      Object.assign(mockAuthConfig, { isAuthEnabled: false });
    });

    it('allows when auth is enabled and usage check passes', async () => {
      Object.assign(mockAuthConfig, { isAuthEnabled: true });
      mockAuth.mockResolvedValue({ user: { id: 'user-456' } });
      mockCanRunAnalysis.mockResolvedValue({ allowed: true, tier: 'pro' });

      const mockCreate = jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(validAnalysis) }],
      });
      MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

      const res = await POST(makeRequest({ texts: [{ filename: 'doc.pdf', text: 'text' }] }));
      expect(res.status).toBe(200);
      expect(mockIncrementUsage).toHaveBeenCalledWith('user-456');

      // Restore
      Object.assign(mockAuthConfig, { isAuthEnabled: false });
    });

    it('handles incrementUsage error gracefully (lines 178-181)', async () => {
      Object.assign(mockAuthConfig, { isAuthEnabled: true });
      mockAuth.mockResolvedValue({ user: { id: 'user-789' } });
      mockCanRunAnalysis.mockResolvedValue({ allowed: true, tier: 'pro' });
      mockIncrementUsage.mockRejectedValue(new Error('DB error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const mockCreate = jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(validAnalysis) }],
      });
      MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

      const res = await POST(makeRequest({ texts: [{ filename: 'doc.pdf', text: 'text' }] }));
      expect(res.status).toBe(200);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to increment usage:', expect.any(Error));
      consoleSpy.mockRestore();

      // Restore
      Object.assign(mockAuthConfig, { isAuthEnabled: false });
    });

    it('returns 400 when texts items are not objects with filename and text (line 138)', async () => {
      const res = await POST(makeRequest({ texts: ['just-a-string'] }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('filename and text');
    });

    it('skips usage check when auth is enabled but session has no user id', async () => {
      Object.assign(mockAuthConfig, { isAuthEnabled: true });
      mockAuth.mockResolvedValue({ user: {} }); // no id

      const mockCreate = jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(validAnalysis) }],
      });
      MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

      const res = await POST(makeRequest({ texts: [{ filename: 'doc.pdf', text: 'text' }] }));
      expect(res.status).toBe(200);
      expect(mockCanRunAnalysis).not.toHaveBeenCalled();

      // Restore
      Object.assign(mockAuthConfig, { isAuthEnabled: false });
    });

    it('handles canRunAnalysis returning undefined tier (line 132)', async () => {
      Object.assign(mockAuthConfig, { isAuthEnabled: true });
      mockAuth.mockResolvedValue({ user: { id: 'user-no-tier' } });
      mockCanRunAnalysis.mockResolvedValue({ allowed: true }); // no tier field

      const mockCreate = jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(validAnalysis) }],
      });
      MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

      const res = await POST(makeRequest({ texts: [{ filename: 'doc.pdf', text: 'text' }] }));
      expect(res.status).toBe(200);

      // Should call serverTrack with tier: null
      expect(serverTrack).toHaveBeenCalledWith('user-no-tier', 'analysis_consumed', {
        user_id: 'user-no-tier',
        tier: null,
        is_byok: false,
      });

      // Restore
      Object.assign(mockAuthConfig, { isAuthEnabled: false });
    });
  });

  describe('PostHog tracking', () => {
    it('calls serverTrack with analysis_consumed on success', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(validAnalysis) }],
      });
      MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

      const res = await POST(makeRequest({ texts: [{ filename: 'doc.pdf', text: 'text' }] }));
      expect(res.status).toBe(200);

      expect(serverTrack).toHaveBeenCalledWith('anonymous', 'analysis_consumed', {
        user_id: null,
        tier: null,
        is_byok: false,
      });
    });

    it('does not call serverTrack when request is invalid (400)', async () => {
      const res = await POST(makeRequest({}));
      expect(res.status).toBe(400);
      expect(serverTrack).not.toHaveBeenCalled();
    });

    it('does not call serverTrack when API key is missing (401)', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      const res = await POST(makeRequest({ texts: [{ filename: 'doc.pdf', text: 'hello' }] }));
      expect(res.status).toBe(401);
      expect(serverTrack).not.toHaveBeenCalled();
    });

    it('does not call serverTrack when Claude API throws (500)', async () => {
      const mockCreate = jest.fn().mockRejectedValue(new Error('API error'));
      MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

      const res = await POST(makeRequest({ texts: [{ filename: 'doc.pdf', text: 'text' }] }));
      expect(res.status).toBe(500);
      expect(serverTrack).not.toHaveBeenCalled();
    });

    it('succeeds even when serverTrack rejects (covers .catch callback)', async () => {
      serverTrack.mockRejectedValueOnce(new Error('PostHog down'));
      const mockCreate = jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(validAnalysis) }],
      });
      MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

      const res = await POST(makeRequest({ texts: [{ filename: 'doc.pdf', text: 'text' }] }));
      expect(res.status).toBe(200);
    });
  });
});
