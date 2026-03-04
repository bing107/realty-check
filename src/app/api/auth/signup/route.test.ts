/**
 * @jest-environment node
 */
import { POST } from "./route";
import { NextRequest } from "next/server";

// Mock bcryptjs
jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("hashed_password_123"),
}));

// Mock prisma
jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const mockPrisma = prisma as unknown as {
  user: {
    findUnique: jest.Mock;
    create: jest.Mock;
  };
};

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/auth/signup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 if email is missing", async () => {
    const res = await POST(makeRequest({ password: "securepass123" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Email and password are required/);
  });

  it("returns 400 if password is missing", async () => {
    const res = await POST(makeRequest({ email: "test@example.com" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Email and password are required/);
  });

  it("returns 400 if email format is invalid", async () => {
    const res = await POST(
      makeRequest({ email: "not-an-email", password: "securepass123" })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid email/);
  });

  it("returns 400 if password is less than 8 characters", async () => {
    const res = await POST(
      makeRequest({ email: "test@example.com", password: "short" })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/at least 8 characters/);
  });

  it("returns 409 if email already exists", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "existing-user-id",
      email: "test@example.com",
    });

    const res = await POST(
      makeRequest({ email: "test@example.com", password: "securepass123" })
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already exists/);
  });

  it("returns 201 with user data on success", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: "new-user-id",
      email: "test@example.com",
      name: "Test User",
    });

    const res = await POST(
      makeRequest({
        email: "test@example.com",
        password: "securepass123",
        name: "Test User",
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("new-user-id");
    expect(body.email).toBe("test@example.com");
    expect(body.name).toBe("Test User");
  });

  it("password is hashed and not stored in plaintext", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: "new-user-id",
      email: "test@example.com",
      name: null,
    });

    await POST(
      makeRequest({
        email: "test@example.com",
        password: "securepass123",
      })
    );

    // bcrypt.hash should have been called with the password and salt rounds
    expect(bcrypt.hash).toHaveBeenCalledWith("securepass123", 12);

    // The create call should use the hashed password, not the plaintext
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          password: "hashed_password_123",
        }),
      })
    );

    // Verify the plaintext password was NOT passed to create
    const createCall = mockPrisma.user.create.mock.calls[0][0];
    expect(createCall.data.password).not.toBe("securepass123");
  });

  it("returns 500 on unexpected errors", async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error("DB connection failed"));

    const res = await POST(
      makeRequest({ email: "test@example.com", password: "securepass123" })
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/Failed to create account/);
  });

  it("returns 409 on P2002 unique constraint error (line 52)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const p2002Error = new Error("Unique constraint failed") as Error & { code: string };
    p2002Error.code = "P2002";
    mockPrisma.user.create.mockRejectedValue(p2002Error);

    const res = await POST(
      makeRequest({
        email: "test@example.com",
        password: "securepass123",
        name: "Test",
      })
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already exists/);
  });
});
