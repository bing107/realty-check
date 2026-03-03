/**
 * @jest-environment node
 */

/**
 * Unit tests for the extract API route handler.
 *
 * We mock fs/promises and pdf-parse to avoid real disk I/O
 * and PDF processing, focusing on the handler logic.
 */

import { NextRequest } from "next/server";

// Mock fs/promises before importing the route
jest.mock("fs/promises", () => ({
  readFile: jest.fn(),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

// Mock pdf-parse/lib/pdf-parse (dynamic import)
jest.mock("pdf-parse/lib/pdf-parse", () => {
  const fn = jest.fn();
  return { __esModule: true, default: fn };
});

import { POST } from "./route";
import { readFile, writeFile } from "fs/promises";

const mockReadFile = readFile as jest.MockedFunction<typeof readFile>;
const mockWriteFile = writeFile as jest.MockedFunction<typeof writeFile>;

// The route does `const mod = await import("pdf-parse/lib/pdf-parse")`
// then `mod.default ?? mod`. Our mock provides `{ default: jest.fn() }`,
// so `mod.default` is the mock function. We access it via require().
const mockPdfParse = require("pdf-parse/lib/pdf-parse").default as jest.Mock;

function buildRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/extract", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns empty results and errors for an empty files array", async () => {
    const req = buildRequest({ files: [] });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ results: [], errors: [] });
  });

  it("returns empty results and errors when files is undefined", async () => {
    const req = buildRequest({});
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ results: [], errors: [] });
  });

  it("returns empty results and errors when files is missing (no body)", async () => {
    const req = new NextRequest("http://localhost:3000/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ results: [], errors: [] });
  });

  it("extracts text from a single PDF file", async () => {
    const fakeBuffer = Buffer.from("fake-pdf-content");
    mockReadFile.mockResolvedValue(fakeBuffer);
    mockPdfParse.mockResolvedValue({
      numpages: 3,
      numrender: 3,
      info: {},
      metadata: {},
      text: "  Hello World  ",
      version: "1.0",
    });

    const req = buildRequest({ files: ["report.pdf"] });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.results).toHaveLength(1);
    expect(body.errors).toHaveLength(0);
    expect(body.results[0].filename).toBe("report.pdf");
    expect(body.results[0].pages).toBe(3);
    expect(body.results[0].text).toBe("Hello World");
    expect(body.results[0].extractedAt).toBeDefined();
    expect(typeof body.results[0].extractedAt).toBe("string");
  });

  it("returns OCR not supported message for PDF with empty text", async () => {
    const fakeBuffer = Buffer.from("fake-pdf-content");
    mockReadFile.mockResolvedValue(fakeBuffer);
    mockPdfParse.mockResolvedValue({
      numpages: 1,
      numrender: 1,
      info: {},
      metadata: {},
      text: "   \n\n  ",
      version: "1.0",
    });

    const req = buildRequest({ files: ["scanned.pdf"] });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.results).toHaveLength(1);
    expect(body.errors).toHaveLength(0);
    expect(body.results[0].text).toBe(
      "OCR not supported: this appears to be a scanned PDF with no extractable text."
    );
  });

  it("returns error when file is not found (ENOENT)", async () => {
    const err = new Error("ENOENT: no such file or directory, open 'missing.pdf'");
    (err as NodeJS.ErrnoException).code = "ENOENT";
    mockReadFile.mockRejectedValue(err);

    const req = buildRequest({ files: ["missing.pdf"] });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.results).toHaveLength(0);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].filename).toBe("missing.pdf");
    expect(body.errors[0].error).toContain("ENOENT");
  });

  it("returns error when pdf-parse throws (corrupt PDF)", async () => {
    const fakeBuffer = Buffer.from("not-a-real-pdf");
    mockReadFile.mockResolvedValue(fakeBuffer);
    mockPdfParse.mockRejectedValue(new Error("Invalid PDF structure"));

    const req = buildRequest({ files: ["corrupt.pdf"] });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.results).toHaveLength(0);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].filename).toBe("corrupt.pdf");
    expect(body.errors[0].error).toBe("Invalid PDF structure");
  });

  it("handles multiple files where one succeeds and one fails", async () => {
    const fakeBuffer = Buffer.from("fake-pdf-content");

    // First file succeeds
    mockReadFile
      .mockResolvedValueOnce(fakeBuffer)
      // Second file fails with ENOENT
      .mockRejectedValueOnce(new Error("ENOENT: no such file or directory"));

    mockPdfParse.mockResolvedValueOnce({
      numpages: 2,
      numrender: 2,
      info: {},
      metadata: {},
      text: "Good content",
      version: "1.0",
    });

    const req = buildRequest({ files: ["good.pdf", "bad.pdf"] });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.results).toHaveLength(1);
    expect(body.results[0].filename).toBe("good.pdf");
    expect(body.results[0].text).toBe("Good content");

    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].filename).toBe("bad.pdf");
    expect(body.errors[0].error).toContain("ENOENT");
  });

  it("writes extracted text to a .txt file alongside the PDF", async () => {
    const fakeBuffer = Buffer.from("fake-pdf-content");
    mockReadFile.mockResolvedValue(fakeBuffer);
    mockPdfParse.mockResolvedValue({
      numpages: 1,
      numrender: 1,
      info: {},
      metadata: {},
      text: "Extracted text content",
      version: "1.0",
    });

    const req = buildRequest({ files: ["document.pdf"] });
    await POST(req);

    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining("document.pdf.txt"),
      "Extracted text content"
    );
  });
});
