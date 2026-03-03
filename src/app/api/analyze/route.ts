import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

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

interface DocumentText {
  filename: string;
  text: string;
}

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

  if (!body || !Array.isArray(body.texts) || body.texts.length === 0) {
    return NextResponse.json({ error: 'texts array required' }, { status: 400 });
  }

  const apiKey = req.headers.get('x-api-key') || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'API key required. Provide your Anthropic key via the X-API-Key header.' },
      { status: 401 }
    );
  }

  const texts: DocumentText[] = body.texts;
  if (!texts.every((t: unknown) => typeof t === 'object' && t !== null && 'filename' in t && 'text' in t)) {
    return NextResponse.json({ error: 'each item in texts must have filename and text' }, { status: 400 });
  }

  const documentTexts = texts
    .map((t) => `--- DOCUMENT: ${t.filename} ---\n${t.text}`)
    .join('\n\n');

  const client = new Anthropic({ apiKey });

  let message: Awaited<ReturnType<typeof client.messages.create>>;
  try {
    message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: USER_PROMPT_TEMPLATE(documentTexts) }],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Claude API error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const content = message.content[0];
  if (content.type !== 'text') {
    return NextResponse.json({ error: 'Unexpected response from Claude' }, { status: 500 });
  }

  let analysis: AnalysisResult;
  try {
    const jsonText = content.text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    analysis = JSON.parse(jsonText);
  } catch {
    return NextResponse.json(
      { error: 'Failed to parse Claude response as JSON', raw: content.text },
      { status: 500 }
    );
  }

  return NextResponse.json({ analysis });
}
