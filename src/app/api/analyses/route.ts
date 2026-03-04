import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const analyses = await prisma.analysis.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      filename: true,
      createdAt: true,
      analysisJson: true,
      metrics: true,
      summary: true,
    },
  });

  return NextResponse.json({ analyses });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { filename, analysisJson, metrics, summary } = await req.json();

  const analysis = await prisma.analysis.create({
    data: {
      userId: session.user.id,
      filename: filename ?? null,
      analysisJson: JSON.stringify(analysisJson),
      metrics: metrics ? JSON.stringify(metrics) : null,
      summary: summary ? JSON.stringify(summary) : null,
    },
    select: { id: true, createdAt: true },
  });

  return NextResponse.json(analysis, { status: 201 });
}
