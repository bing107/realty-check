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

  it('returns 401 when no API key is provided (no header, no env var)', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    mockFsReadFile.mockResolvedValue('some text');
    const res = await POST(makeRequest({ files: ['test.pdf'] }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/API key required/);
  });

  it('succeeds when API key is provided via X-API-Key header (no env var)', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    mockFsReadFile.mockResolvedValue('Extracted document text');
    mockFsWriteFile.mockResolvedValue(undefined);

    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(validAnalysis) }],
    });
    MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

    const req = new NextRequest('http://localhost/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ files: ['test.pdf'] }),
      headers: { 'content-type': 'application/json', 'x-api-key': 'header-key-123' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(MockAnthropic).toHaveBeenCalledWith({ apiKey: 'header-key-123' });
  });

  it('falls back to env var when no X-API-Key header is provided', async () => {
    process.env.ANTHROPIC_API_KEY = 'env-key-456';
    mockFsReadFile.mockResolvedValue('Extracted document text');
    mockFsWriteFile.mockResolvedValue(undefined);

    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(validAnalysis) }],
    });
    MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

    const res = await POST(makeRequest({ files: ['test.pdf'] }));
    expect(res.status).toBe(200);
    expect(MockAnthropic).toHaveBeenCalledWith({ apiKey: 'env-key-456' });
  });

  it('prefers X-API-Key header over env var when both are present', async () => {
    process.env.ANTHROPIC_API_KEY = 'env-key-456';
    mockFsReadFile.mockResolvedValue('Extracted document text');
    mockFsWriteFile.mockResolvedValue(undefined);

    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(validAnalysis) }],
    });
    MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

    const req = new NextRequest('http://localhost/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ files: ['test.pdf'] }),
      headers: { 'content-type': 'application/json', 'x-api-key': 'header-key-789' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(MockAnthropic).toHaveBeenCalledWith({ apiKey: 'header-key-789' });
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

  it('returns 400 when request body is not valid JSON', async () => {
    const req = new NextRequest('http://localhost/api/analyze', {
      method: 'POST',
      body: 'not-json{{{',
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/files array required/);
  });

  it('returns 500 when Claude returns non-text content type', async () => {
    mockFsReadFile.mockResolvedValue('Extracted text');
    mockFsWriteFile.mockResolvedValue(undefined);

    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: 'tool_use', id: 'tool_1', name: 'some_tool', input: {} }],
    });
    MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

    const res = await POST(makeRequest({ files: ['doc.pdf'] }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/Unexpected response/);
  });

  it('returns 500 when Claude returns invalid JSON text', async () => {
    mockFsReadFile.mockResolvedValue('Extracted text');
    mockFsWriteFile.mockResolvedValue(undefined);

    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'This is not JSON at all' }],
    });
    MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

    const res = await POST(makeRequest({ files: ['doc.pdf'] }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/Failed to parse/);
    expect(body.raw).toBe('This is not JSON at all');
  });

  it('sends all document texts with correct separator format for multiple files', async () => {
    mockFsReadFile
      .mockResolvedValueOnce('Text from first document')
      .mockResolvedValueOnce('Text from second document');
    mockFsWriteFile.mockResolvedValue(undefined);

    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(validAnalysis) }],
    });
    MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

    const res = await POST(makeRequest({ files: ['doc1.pdf', 'doc2.pdf'] }));
    expect(res.status).toBe(200);

    // Verify Claude was called with both documents separated correctly
    const callArgs = mockCreate.mock.calls[0][0];
    const userContent = callArgs.messages[0].content;
    expect(userContent).toContain('--- DOCUMENT: doc1.pdf ---');
    expect(userContent).toContain('Text from first document');
    expect(userContent).toContain('--- DOCUMENT: doc2.pdf ---');
    expect(userContent).toContain('Text from second document');
  });

  it('returns partial success when some files are found and others are not', async () => {
    mockFsReadFile
      .mockResolvedValueOnce('Found document text')
      .mockRejectedValueOnce(new Error('ENOENT'));
    mockFsWriteFile.mockResolvedValue(undefined);

    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(validAnalysis) }],
    });
    MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

    const res = await POST(makeRequest({ files: ['found.pdf', 'missing.pdf'] }));
    expect(res.status).toBe(200);
    const body = await res.json();

    // Analysis should still proceed with the found file
    expect(body.analysis).toEqual(validAnalysis);
    // Errors should report the missing file
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].filename).toBe('missing.pdf');
    expect(body.errors[0].error).toMatch(/extraction/i);
  });

  it('saves analysis result as a timestamped JSON file', async () => {
    mockFsReadFile.mockResolvedValue('Extracted text');
    mockFsWriteFile.mockResolvedValue(undefined);

    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(validAnalysis) }],
    });
    MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

    const res = await POST(makeRequest({ files: ['doc.pdf'] }));
    expect(res.status).toBe(200);
    const body = await res.json();

    // Verify writeFile was called to save the analysis
    expect(mockFsWriteFile).toHaveBeenCalledTimes(1);
    const writtenPath = mockFsWriteFile.mock.calls[0][0] as string;
    const writtenContent = mockFsWriteFile.mock.calls[0][1] as string;

    expect(writtenPath).toContain('uploads');
    expect(writtenPath).toMatch(/analysis-.*\.json$/);
    expect(JSON.parse(writtenContent)).toEqual(validAnalysis);
    // The savedAs field in the response should match the filename
    expect(body.savedAs).toMatch(/^analysis-.*\.json$/);
  });

  it('returns 500 when Claude API call throws', async () => {
    mockFsReadFile.mockResolvedValue('Extracted text');

    const mockCreate = jest.fn().mockRejectedValue(new Error('API rate limit exceeded'));
    MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

    const res = await POST(makeRequest({ files: ['doc.pdf'] }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/API rate limit exceeded/);
  });
});
