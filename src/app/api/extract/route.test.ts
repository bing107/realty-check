/**
 * @jest-environment node
 */

/**
 * Unit tests for the extract API route handler.
 *
 * We mock pdf-parse to avoid real PDF processing,
 * focusing on the handler logic with FormData input.
 */

import { NextRequest } from "next/server";

// Mock pdf-parse/lib/pdf-parse (dynamic import)
jest.mock("pdf-parse/lib/pdf-parse", () => {
  const fn = jest.fn();
  return { __esModule: true, default: fn };
});

import { POST } from "./route";

const mockPdfParse = require("pdf-parse/lib/pdf-parse").default as jest.Mock;

// PDF magic bytes: %PDF
const PDF_HEADER = Buffer.from([0x25, 0x50, 0x44, 0x46]);

function makePdfBlob(content: string = "fake-pdf-content"): File {
  const buf = Buffer.concat([PDF_HEADER, Buffer.from(content)]);
  return new File([buf], "report.pdf", { type: "application/pdf" });
}

function makeNonPdfBlob(): File {
  return new File([Buffer.from("not a pdf")], "bad.txt", {
    type: "text/plain",
  });
}

function buildFormRequest(files: File[]): NextRequest {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));
  return new NextRequest("http://localhost:3000/api/extract", {
    method: "POST",
    body: formData,
  });
}

describe("POST /api/extract", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns empty results for request with no files", async () => {
    const formData = new FormData();
    const req = new NextRequest("http://localhost:3000/api/extract", {
      method: "POST",
      body: formData,
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ results: [], errors: [] });
  });

  it("extracts text from a single PDF file", async () => {
    mockPdfParse.mockResolvedValue({
      numpages: 3,
      text: "  Hello World  ",
    });

    const req = buildFormRequest([makePdfBlob()]);
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.results).toHaveLength(1);
    expect(body.errors).toHaveLength(0);
    expect(body.results[0].filename).toBe("report.pdf");
    expect(body.results[0].pages).toBe(3);
    expect(body.results[0].text).toBe("Hello World");
  });

  it("rejects non-PDF files based on magic bytes", async () => {
    const req = buildFormRequest([makeNonPdfBlob()]);
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.results).toHaveLength(0);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].error).toMatch(/not a valid pdf/i);
  });

  it("returns OCR not supported message for PDF with empty text", async () => {
    mockPdfParse.mockResolvedValue({
      numpages: 1,
      text: "   \n\n  ",
    });

    const req = buildFormRequest([makePdfBlob()]);
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.results).toHaveLength(1);
    expect(body.results[0].text).toBe(
      "OCR not supported: this appears to be a scanned PDF with no extractable text."
    );
  });

  it("returns error when pdf-parse throws (corrupt PDF)", async () => {
    mockPdfParse.mockRejectedValue(new Error("Invalid PDF structure"));

    const req = buildFormRequest([makePdfBlob()]);
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.results).toHaveLength(0);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].error).toBe("Invalid PDF structure");
  });

  it("handles multiple files where one succeeds and one fails", async () => {
    mockPdfParse
      .mockResolvedValueOnce({ numpages: 2, text: "Good content" })
      .mockRejectedValueOnce(new Error("Corrupt file"));

    const good = makePdfBlob("good");
    const bad = new File(
      [Buffer.concat([PDF_HEADER, Buffer.from("bad")])],
      "bad.pdf",
      { type: "application/pdf" }
    );

    const req = buildFormRequest([good, bad]);
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.results).toHaveLength(1);
    expect(body.results[0].text).toBe("Good content");
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].error).toBe("Corrupt file");
  });
});
