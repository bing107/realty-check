/**
 * @jest-environment node
 */
import { GET, POST } from "./route";
import { NextRequest } from "next/server";

// Mock auth
jest.mock("@/auth", () => ({
  auth: jest.fn(),
}));

// Mock prisma
jest.mock("@/lib/prisma", () => ({
  prisma: {
    analysis: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = auth as jest.Mock;
const mockPrisma = prisma as unknown as {
  analysis: {
    findMany: jest.Mock;
    create: jest.Mock;
  };
};

function makePostRequest(body: unknown) {
  return new NextRequest("http://localhost/api/analyses", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("GET /api/analyses", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 if not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 if session has no user id", async () => {
    mockAuth.mockResolvedValue({ user: {} });

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns analyses list when authenticated", async () => {
    const mockAnalyses = [
      {
        id: "analysis-1",
        filename: "test.pdf",
        createdAt: "2026-01-01T00:00:00.000Z",
        analysisJson: '{"summary":"test"}',
        metrics: null,
        summary: null,
      },
      {
        id: "analysis-2",
        filename: "other.pdf",
        createdAt: "2026-01-02T00:00:00.000Z",
        analysisJson: '{"summary":"other"}',
        metrics: '{"grossYield":0.05}',
        summary: null,
      },
    ];

    mockAuth.mockResolvedValue({ user: { id: "user-123" } });
    mockPrisma.analysis.findMany.mockResolvedValue(mockAnalyses);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.analyses).toEqual(mockAnalyses);
    expect(body.analyses).toHaveLength(2);

    // Verify the query filters by userId
    expect(mockPrisma.analysis.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-123" },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
    );
  });
});

describe("POST /api/analyses", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 if not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const res = await POST(
      makePostRequest({
        filename: "test.pdf",
        analysisJson: { summary: "test" },
      })
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 if session has no user id", async () => {
    mockAuth.mockResolvedValue({ user: {} });

    const res = await POST(
      makePostRequest({
        filename: "test.pdf",
        analysisJson: { summary: "test" },
      })
    );
    expect(res.status).toBe(401);
  });

  it("saves analysis when authenticated", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-123" } });
    mockPrisma.analysis.create.mockResolvedValue({
      id: "new-analysis-id",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const analysisData = {
      filename: "test.pdf",
      analysisJson: { summary: "test analysis" },
      metrics: { grossYield: 0.05 },
      summary: { investmentSummary: "Good deal" },
    };

    const res = await POST(makePostRequest(analysisData));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("new-analysis-id");

    // Verify prisma.analysis.create was called with correct data
    expect(mockPrisma.analysis.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-123",
          filename: "test.pdf",
          analysisJson: JSON.stringify({ summary: "test analysis" }),
          metrics: JSON.stringify({ grossYield: 0.05 }),
          summary: JSON.stringify({ investmentSummary: "Good deal" }),
        }),
      })
    );
  });

  it("stores null for optional fields when not provided", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-123" } });
    mockPrisma.analysis.create.mockResolvedValue({
      id: "new-analysis-id",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const analysisData = {
      analysisJson: { summary: "minimal" },
    };

    const res = await POST(makePostRequest(analysisData));
    expect(res.status).toBe(201);

    expect(mockPrisma.analysis.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-123",
          filename: null,
          metrics: null,
          summary: null,
        }),
      })
    );
  });

  it("returns 400 when analysisJson is not provided (line 36)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-123" } });

    const res = await POST(makePostRequest({ filename: "test.pdf" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("analysisJson is required");
  });

  it("returns 400 when body is malformed JSON (line 36 catch)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-123" } });

    const req = new NextRequest("http://localhost/api/analyses", {
      method: "POST",
      body: "not-json{{{",
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 500 when prisma.analysis.create throws (line 58)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-123" } });
    mockPrisma.analysis.create.mockRejectedValue(new Error("DB error"));

    const res = await POST(
      makePostRequest({
        filename: "test.pdf",
        analysisJson: { summary: "test" },
      })
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to save analysis");
  });
});
