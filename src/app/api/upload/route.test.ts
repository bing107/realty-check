/**
 * @jest-environment node
 */

/**
 * Unit tests for the upload API route handler.
 *
 * We mock fs/promises to avoid real disk I/O and focus on
 * the validation logic inside the POST handler.
 *
 * Uses the "node" jest-environment so that the Web API globals
 * (Request, Response, Headers, etc.) required by next/server
 * are available.
 */

import { NextRequest } from "next/server";

// Mock fs/promises before importing the route
jest.mock("fs/promises", () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
}));

import { POST } from "./route";
import { writeFile, mkdir } from "fs/promises";

/**
 * Node 18 does not expose a global File class.
 * We import it from the built-in node:buffer module.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { File: NodeFile } = require("node:buffer");
const FilePolyfill = NodeFile as typeof globalThis.File;

function createMockFile(
  name: string,
  size: number,
  type: string
): File {
  const buffer = new ArrayBuffer(size);
  return new FilePolyfill([buffer], name, { type });
}

function buildRequest(file?: File): NextRequest {
  const formData = new FormData();
  if (file) {
    formData.append("file", file);
  }
  return new NextRequest("http://localhost:3000/api/upload", {
    method: "POST",
    body: formData,
  });
}

describe("POST /api/upload", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 when no file is provided", async () => {
    const req = buildRequest(); // no file attached
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("No file provided");
  });

  it("returns 400 when file is not a PDF", async () => {
    const file = createMockFile("image.png", 1024, "image/png");
    const req = buildRequest(file);
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Only PDF files are accepted");
  });

  it("returns 400 when file exceeds 20MB", async () => {
    const oversize = 21 * 1024 * 1024; // 21 MB
    const file = createMockFile("big.pdf", oversize, "application/pdf");
    const req = buildRequest(file);
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("File exceeds 20MB limit");
  });

  it("returns 200 with saved filename for valid PDF under 20MB", async () => {
    const file = createMockFile("report.pdf", 5000, "application/pdf");
    const req = buildRequest(file);
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("report.pdf");
    expect(body.size).toBe(5000);
    expect(body.saved).toMatch(/^\d+-report\.pdf$/);
  });

  it("creates upload directory and writes the file to disk", async () => {
    const file = createMockFile("doc.pdf", 2048, "application/pdf");
    const req = buildRequest(file);
    await POST(req);

    expect(mkdir).toHaveBeenCalledWith(
      expect.stringContaining("uploads"),
      { recursive: true }
    );
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining("uploads"),
      expect.any(Buffer)
    );
  });

  it("sanitises dangerous characters in the saved filename", async () => {
    const file = createMockFile(
      "../../etc/passwd.pdf",
      100,
      "application/pdf"
    );
    const req = buildRequest(file);
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    // slashes and dots (other than the extension dot) should be replaced
    expect(body.saved).not.toContain("/");
    expect(body.saved).not.toContain("..");
  });
});
