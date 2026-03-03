/**
 * @jest-environment node
 */
import { POST } from './route';
import { NextRequest } from 'next/server';

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
}));

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

const mockFsReadFile = jest.requireMock('fs/promises').readFile;
const mockFsWriteFile = jest.requireMock('fs/promises').writeFile;
const MockAnthropic = jest.requireMock('@anthropic-ai/sdk').default;

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

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/analyze', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
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

  it('returns 400 when files array is missing', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns 400 when files array is empty', async () => {
    const res = await POST(makeRequest({ files: [] }));
    expect(res.status).toBe(400);
  });

  it('returns 500 when ANTHROPIC_API_KEY is not set', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    mockFsReadFile.mockResolvedValue('some text');
    const res = await POST(makeRequest({ files: ['test.pdf'] }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/ANTHROPIC_API_KEY/);
  });

  it('returns 400 when no extracted text files exist', async () => {
    mockFsReadFile.mockRejectedValue(new Error('ENOENT'));
    const res = await POST(makeRequest({ files: ['missing.pdf'] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/extraction/i);
  });

  it('returns structured analysis on success', async () => {
    mockFsReadFile.mockResolvedValue('Extracted document text');
    mockFsWriteFile.mockResolvedValue(undefined);

    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(validAnalysis) }],
    });
    MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

    const res = await POST(makeRequest({ files: ['doc1.pdf'] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.analysis).toEqual(validAnalysis);
    expect(body.savedAs).toMatch(/analysis-.*\.json/);
  });

  it('strips markdown code fences from Claude response', async () => {
    mockFsReadFile.mockResolvedValue('text');
    mockFsWriteFile.mockResolvedValue(undefined);

    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: '```json\n' + JSON.stringify(validAnalysis) + '\n```' }],
    });
    MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

    const res = await POST(makeRequest({ files: ['doc.pdf'] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.analysis.redFlags).toEqual(['Low reserve fund']);
  });

  it('prevents path traversal in filenames', async () => {
    mockFsReadFile.mockResolvedValue('text');
    mockFsWriteFile.mockResolvedValue(undefined);

    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(validAnalysis) }],
    });
    MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

    await POST(makeRequest({ files: ['../../../etc/passwd.pdf'] }));

    // Verify readFile was called with a safe path (no traversal)
    const calledPath = mockFsReadFile.mock.calls[0][0] as string;
    expect(calledPath).not.toContain('..');
  });
});
