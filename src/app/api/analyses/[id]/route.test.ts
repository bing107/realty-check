/**
 * @jest-environment node
 */
import { GET } from "./route";
import { NextRequest } from "next/server";

// Mock auth
jest.mock("@/auth", () => ({
  auth: jest.fn(),
}));

// Mock prisma
jest.mock("@/lib/prisma", () => ({
  prisma: {
    analysis: {
      findFirst: jest.fn(),
    },
  },
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = auth as jest.Mock;
const mockPrisma = prisma as unknown as {
  analysis: {
    findFirst: jest.Mock;
  };
};

function makeGetRequest(id: string) {
  return new NextRequest(`http://localhost/api/analyses/${id}`, {
    method: "GET",
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/analyses/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when no session", async () => {
    mockAuth.mockResolvedValue(null);

    const res = await GET(makeGetRequest("analysis-1"), makeParams("analysis-1"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 when session has no user id", async () => {
    mockAuth.mockResolvedValue({ user: {} });

    const res = await GET(makeGetRequest("analysis-1"), makeParams("analysis-1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when analysis not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-123" } });
    mockPrisma.analysis.findFirst.mockResolvedValue(null);

    const res = await GET(makeGetRequest("nonexistent"), makeParams("nonexistent"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Not found");

    // Verify query includes both id and userId (prevents accessing other users' data)
    expect(mockPrisma.analysis.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "nonexistent", userId: "user-123" },
      })
    );
  });

  it("returns 404 when analysis belongs to a different user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-123" } });
    // findFirst with userId filter will return null for another user's analysis
    mockPrisma.analysis.findFirst.mockResolvedValue(null);

    const res = await GET(makeGetRequest("other-user-analysis"), makeParams("other-user-analysis"));
    expect(res.status).toBe(404);

    expect(mockPrisma.analysis.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "other-user-analysis", userId: "user-123" },
      })
    );
  });

  it("returns analysis data when found", async () => {
    const mockAnalysis = {
      id: "analysis-1",
      filename: "test-property.pdf",
      createdAt: "2026-01-15T10:30:00.000Z",
      analysisJson: '{"summary":"Great property"}',
      metrics: '{"grossYield":0.065}',
      summary: '{"investmentSummary":"Good deal"}',
    };

    mockAuth.mockResolvedValue({ user: { id: "user-123" } });
    mockPrisma.analysis.findFirst.mockResolvedValue(mockAnalysis);

    const res = await GET(makeGetRequest("analysis-1"), makeParams("analysis-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.analysis).toEqual(mockAnalysis);
    expect(body.analysis.id).toBe("analysis-1");
    expect(body.analysis.filename).toBe("test-property.pdf");
  });

  it("selects only the expected fields", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-123" } });
    mockPrisma.analysis.findFirst.mockResolvedValue({
      id: "analysis-1",
      filename: "test.pdf",
      createdAt: "2026-01-01T00:00:00.000Z",
      analysisJson: "{}",
      metrics: null,
      summary: null,
    });

    await GET(makeGetRequest("analysis-1"), makeParams("analysis-1"));

    expect(mockPrisma.analysis.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          filename: true,
          createdAt: true,
          analysisJson: true,
          metrics: true,
          summary: true,
        },
      })
    );
  });
});
