import { NextRequest, NextResponse } from "next/server";

async function parsePdf(buffer: Buffer) {
  const mod = await import("pdf-parse/lib/pdf-parse");
  const pdfParse = mod.default ?? mod;
  return pdfParse(buffer) as Promise<{ numpages: number; text: string }>;
}

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
  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ results: [], errors: [] });
  }

  const files = formData.getAll("files") as File[];
  if (files.length === 0) {
    return NextResponse.json({ results: [], errors: [] });
  }

  const results: ExtractResult[] = [];
  const errors: ExtractError[] = [];

  for (const file of files) {
    try {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Validate PDF magic bytes
      if (
        buffer.length < 4 ||
        buffer[0] !== 0x25 ||
        buffer[1] !== 0x50 ||
        buffer[2] !== 0x44 ||
        buffer[3] !== 0x46
      ) {
        errors.push({ filename: file.name, error: "Not a valid PDF file" });
        continue;
      }

      const result = await parsePdf(buffer);

      let text = result.text.trim();
      if (!text) {
        text =
          "OCR not supported: this appears to be a scanned PDF with no extractable text.";
      }

      results.push({
        filename: file.name,
        pages: result.numpages,
        text,
        extractedAt: new Date().toISOString(),
      });
    } catch (err) {
      errors.push({
        filename: file.name,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ results, errors });
}
