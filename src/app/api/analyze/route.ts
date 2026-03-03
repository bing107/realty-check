import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

const SYSTEM_PROMPT = `You are an expert German real estate investment analyst. You analyze documents related to property purchases (Exposés, Teilungserklärungen, Protokolle, Wirtschaftspläne, etc.) and extract structured financial and risk data.

Always respond with valid JSON only — no markdown, no explanations. If a field cannot be determined from the documents, use null. For arrays, use empty arrays [] if nothing applies.`;

const USER_PROMPT_TEMPLATE = (documentTexts: string) => `Analyze the following real estate documents and return a JSON object with this exact structure:

{
  "property": {
    "address": string | null,
    "sqm": number | null,
    "units": number | null,
    "yearBuilt": number | null,
    "type": "ETW" | "MFH" | "other" | null
  },
  "financials": {
    "purchasePrice": number | null,
    "hausgeld": number | null,
    "ruecklage": number | null,
    "currentRent": number | null,
    "expectedRent": number | null,
    "grunderwerbsteuer": number | null,
    "notarFees": number | null,
    "maklerFees": number | null
  },
  "protocols": {
    "upcomingRenovations": string[],
    "sonderumlagen": string[],
    "maintenanceBacklog": string[],
    "disputes": string[]
  },
  "wirtschaftsplan": {
    "annualBudget": number | null,
    "reserveFundStatus": string | null,
    "plannedMajorWorks": string[]
  },
  "redFlags": string[],
  "summary": string
}

All monetary values should be in EUR as plain numbers (no currency symbols).
The "summary" field should be 2-4 sentences summarizing the investment opportunity and key concerns.

--- DOCUMENTS START ---

${documentTexts}

--- DOCUMENTS END ---`;

interface AnalysisResult {
  property: {
    address: string | null;
    sqm: number | null;
    units: number | null;
    yearBuilt: number | null;
    type: 'ETW' | 'MFH' | 'other' | null;
  };
  financials: {
    purchasePrice: number | null;
    hausgeld: number | null;
    ruecklage: number | null;
    currentRent: number | null;
    expectedRent: number | null;
    grunderwerbsteuer: number | null;
    notarFees: number | null;
    maklerFees: number | null;
  };
  protocols: {
    upcomingRenovations: string[];
    sonderumlagen: string[];
    maintenanceBacklog: string[];
    disputes: string[];
  };
  wirtschaftsplan: {
    annualBudget: number | null;
    reserveFundStatus: string | null;
    plannedMajorWorks: string[];
  };
  redFlags: string[];
  summary: string;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.files) || body.files.length === 0) {
    return NextResponse.json({ error: 'files array required' }, { status: 400 });
  }

  const apiKey = req.headers.get('x-api-key') || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'API key required. Provide your Anthropic key via the X-API-Key header.' },
      { status: 401 }
    );
  }

  // Read extracted text files
  const documentParts: string[] = [];
  const errors: { filename: string; error: string }[] = [];

  if (!body.files.every((f: unknown) => typeof f === 'string' && f.length > 0)) {
    return NextResponse.json({ error: 'each file must be a non-empty string' }, { status: 400 });
  }

  for (const filename of body.files) {
    // Security: prevent path traversal
    const safe = path.basename(filename);
    const txtName = safe.replace(/\.pdf$/i, '.txt');
    const txtPath = path.join(UPLOADS_DIR, txtName);

    try {
      const text = await fs.readFile(txtPath, 'utf-8');
      documentParts.push(`--- DOCUMENT: ${safe} ---\n${text}`);
    } catch {
      // Try reading the pdf text directly if txt not found
      errors.push({ filename: safe, error: 'Extracted text not found — run extraction first' });
    }
  }

  if (documentParts.length === 0) {
    return NextResponse.json(
      { error: 'No extracted text found. Please run text extraction first.', errors },
      { status: 400 }
    );
  }

  const documentTexts = documentParts.join('\n\n');

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: USER_PROMPT_TEMPLATE(documentTexts),
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== 'text') {
    return NextResponse.json({ error: 'Unexpected response from Claude' }, { status: 500 });
  }

  let analysis: AnalysisResult;
  try {
    // Strip potential markdown code fences if Claude adds them
    const jsonText = content.text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    analysis = JSON.parse(jsonText);
  } catch {
    return NextResponse.json(
      { error: 'Failed to parse Claude response as JSON', raw: content.text },
      { status: 500 }
    );
  }

  // Save analysis result
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(UPLOADS_DIR, `analysis-${timestamp}.json`);
  try {
    await fs.writeFile(outputPath, JSON.stringify(analysis, null, 2), 'utf-8');
  } catch {
    return NextResponse.json({ analysis, errors, saveError: 'Failed to persist result' });
  }

  return NextResponse.json({ analysis, errors, savedAs: `analysis-${timestamp}.json` });
}
