import { NextRequest, NextResponse } from 'next/server';
import { computeMetrics, type AnalysisResult, type MortgageAssumptions } from '@/lib/calculator';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body || !body.analysis) {
    return NextResponse.json(
      { error: 'analysis object is required in request body' },
      { status: 400 },
    );
  }

  const analysis: AnalysisResult = body.analysis;
  const assumptions: Partial<MortgageAssumptions> | undefined = body.assumptions;

  const metrics = computeMetrics(analysis, assumptions);

  return NextResponse.json({ metrics });
}
