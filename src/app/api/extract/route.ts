import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import path from "path";
// Dynamic import avoids pdf-parse's index.js debug code that tries
// to read a test PDF at module init time (breaks Next.js build).
async function parsePdf(buffer: Buffer) {
  const mod = await import("pdf-parse/lib/pdf-parse");
  const pdfParse = mod.default ?? mod;
  return pdfParse(buffer) as Promise<{ numpages: number; text: string }>;
}

const UPLOAD_DIR = path.join(process.env.VERCEL ? "/tmp" : process.cwd(), "uploads");

interface ExtractResult {
  filename: string;
  pages: number;
  text: string;
  extractedAt: string;
}

interface ExtractError {
  filename: string;
  error: string;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const files: string[] = body.files;

  if (!files || !Array.isArray(files) || files.length === 0) {
    return NextResponse.json({ results: [], errors: [] });
  }

  const results: ExtractResult[] = [];
  const errors: ExtractError[] = [];

  for (const filename of files) {
    try {
      const filePath = path.join(UPLOAD_DIR, filename);
      if (!filePath.startsWith(UPLOAD_DIR + path.sep)) {
        errors.push({ filename, error: "Invalid filename" });
        continue;
      }

      const buffer = await readFile(filePath);
      const result = await parsePdf(buffer);

      let text = result.text.trim();
      if (!text) {
        text =
          "OCR not supported: this appears to be a scanned PDF with no extractable text.";
      }

      const outPath = path.join(UPLOAD_DIR, `${filename}.txt`);
      if (!outPath.startsWith(UPLOAD_DIR + path.sep)) {
        errors.push({ filename, error: "Invalid filename" });
        continue;
      }
      await writeFile(outPath, text);

      results.push({
        filename,
        pages: result.numpages,
        text,
        extractedAt: new Date().toISOString(),
      });
    } catch (err) {
      errors.push({
        filename,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ results, errors });
}
