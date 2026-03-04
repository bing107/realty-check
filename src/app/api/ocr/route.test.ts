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

function makeRequest(body: unknown, headers?: Record<string, string>) {
  return new NextRequest('http://localhost/api/ocr', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...headers },
  });
}

describe('POST /api/ocr', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('returns 400 when images array is missing', async () => {
    const res = await POST(makeRequest({ filename: 'doc.pdf' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/images array required/);
  });

  it('returns 400 when images array is empty', async () => {
    const res = await POST(makeRequest({ images: [], filename: 'doc.pdf' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/images array required/);
  });

  it('returns 400 when body is not valid JSON', async () => {
    const req = new NextRequest('http://localhost/api/ocr', {
      method: 'POST',
      body: 'not json',
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 401 when no API key is available', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await POST(makeRequest({
      images: ['data:image/jpeg;base64,abc123'],
      filename: 'doc.pdf',
    }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/API key required/);
  });

  it('returns extracted text when Claude responds successfully', async () => {
    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Extracted document text from OCR' }],
    });
    MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

    const res = await POST(makeRequest({
      images: ['data:image/jpeg;base64,abc123'],
      filename: 'scan.pdf',
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe('Extracted document text from OCR');
  });

  it('sends image blocks to Claude with base64 data stripped of data URL prefix', async () => {
    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'OCR result' }],
    });
    MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

    await POST(makeRequest({
      images: ['data:image/jpeg;base64,AAAA', 'data:image/jpeg;base64,BBBB'],
      filename: 'scan.pdf',
    }));

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockCreate.mock.calls[0][0];
    const content = callArgs.messages[0].content;

    // Should have 2 image blocks + 1 text block
    expect(content).toHaveLength(3);
    expect(content[0].type).toBe('image');
    expect(content[0].source.data).toBe('AAAA');
    expect(content[1].type).toBe('image');
    expect(content[1].source.data).toBe('BBBB');
    expect(content[2].type).toBe('text');
  });

  it('returns 500 when Claude API throws an error', async () => {
    const mockCreate = jest.fn().mockRejectedValue(new Error('Rate limit exceeded'));
    MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

    const res = await POST(makeRequest({
      images: ['data:image/jpeg;base64,abc123'],
      filename: 'scan.pdf',
    }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/Rate limit exceeded/);
  });

  it('returns 500 when Claude returns non-text content type', async () => {
    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: 'tool_use', id: 'tool_1', name: 'some_tool', input: {} }],
    });
    MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

    const res = await POST(makeRequest({
      images: ['data:image/jpeg;base64,abc123'],
      filename: 'scan.pdf',
    }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/Unexpected response/);
  });

  it('uses X-API-Key header when provided (BYOK mode)', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'OCR text' }],
    });
    MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

    const res = await POST(makeRequest(
      { images: ['data:image/jpeg;base64,abc123'], filename: 'scan.pdf' },
      { 'x-api-key': 'user-provided-key' },
    ));
    expect(res.status).toBe(200);
    expect(MockAnthropic).toHaveBeenCalledWith({ apiKey: 'user-provided-key' });
  });

  it('prefers X-API-Key header over env var', async () => {
    process.env.ANTHROPIC_API_KEY = 'env-key';

    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'OCR text' }],
    });
    MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

    const res = await POST(makeRequest(
      { images: ['data:image/jpeg;base64,abc123'], filename: 'scan.pdf' },
      { 'x-api-key': 'header-key' },
    ));
    expect(res.status).toBe(200);
    expect(MockAnthropic).toHaveBeenCalledWith({ apiKey: 'header-key' });
  });

  it('falls back to env var when no X-API-Key header is provided', async () => {
    process.env.ANTHROPIC_API_KEY = 'env-key-456';

    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'OCR text' }],
    });
    MockAnthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

    const res = await POST(makeRequest({
      images: ['data:image/jpeg;base64,abc123'],
      filename: 'scan.pdf',
    }));
    expect(res.status).toBe(200);
    expect(MockAnthropic).toHaveBeenCalledWith({ apiKey: 'env-key-456' });
  });

  it('returns 400 when images array contains non-strings (line 20)', async () => {
    const res = await POST(makeRequest({
      images: [123, null],
      filename: 'scan.pdf',
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/base64 strings/);
  });
});
