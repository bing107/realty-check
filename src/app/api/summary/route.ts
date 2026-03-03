import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { AnalysisResult, CalculatedMetrics } from '@/lib/calculator';

const SYSTEM_PROMPT =
  'You are a German real estate investment expert. Always respond with valid JSON only.';

function buildUserPrompt(analysis: AnalysisResult, metrics: CalculatedMetrics): string {
  return `Based on the following real estate analysis data and calculated investment metrics, generate an investment summary and area price comparison.

--- ANALYSIS DATA ---
${JSON.stringify(analysis, null, 2)}

--- CALCULATED METRICS ---
${JSON.stringify(metrics, null, 2)}

Return a JSON object with this exact structure (no markdown, no code fences, just raw JSON):

{
  "investmentSummary": "paragraph1\\n\\nparagraph2\\n\\nparagraph3",
  "priceComparison": {
    "city": "city name",
    "areaAvgPerSqm": number,
    "areaMinPerSqm": number,
    "areaMaxPerSqm": number
  }
}

For "investmentSummary": Write 2-3 paragraphs covering the financial outlook, risks from protocol findings, and market positioning. Separate paragraphs with \\n\\n.

For "priceComparison": Based on the property's address/location from the analysis, estimate the typical price per square meter range for that area using your knowledge of the German real estate market. Use the city or district from the address. The values should be realistic EUR/m² figures for that specific location.

If the property address is unknown, set priceComparison to null.`;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body || !body.analysis || !body.metrics) {
    return NextResponse.json(
      { error: 'analysis and metrics objects are required' },
      { status: 400 },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not configured' },
      { status: 500 },
    );
  }

  const analysis: AnalysisResult = body.analysis;
  const metrics: CalculatedMetrics = body.metrics;

  const client = new Anthropic({ apiKey });

  let message: Awaited<ReturnType<typeof client.messages.create>>;
  try {
    message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: buildUserPrompt(analysis, metrics),
        },
      ],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Claude API error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  if (!message.content.length || message.content[0].type !== 'text') {
    return NextResponse.json(
      { error: 'Unexpected response from Claude' },
      { status: 500 },
    );
  }
  const content = message.content[0];

  let parsed: {
    investmentSummary: string;
    priceComparison: {
      city: string;
      areaAvgPerSqm: number;
      areaMinPerSqm: number;
      areaMaxPerSqm: number;
    } | null;
  };

  try {
    const jsonText = content.text
      .replace(/^```(?:json)?\n?/, '')
      .replace(/\n?```$/, '')
      .trim();
    parsed = JSON.parse(jsonText);
  } catch {
    return NextResponse.json(
      { error: 'Failed to parse Claude response as JSON', raw: content.text },
      { status: 500 },
    );
  }

  return NextResponse.json({
    investmentSummary: parsed.investmentSummary,
    priceComparison: parsed.priceComparison,
  });
}
