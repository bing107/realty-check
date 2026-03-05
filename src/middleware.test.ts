/**
 * @jest-environment node
 */

jest.mock("@/auth", () => {
  const handler: { current: ((req: unknown) => unknown) | null } = { current: null };
  return {
    auth: (fn: (req: unknown) => unknown) => {
      handler.current = fn;
      return fn;
    },
    __handler: handler,
  };
});

import middleware, { config } from "./middleware";

// Get the handler reference from the mock
const { __handler } = jest.requireMock("@/auth") as {
  __handler: { current: ((req: unknown) => unknown) | null };
};

describe("middleware", () => {
  it("config.matcher is set correctly", () => {
    expect(config.matcher).toEqual([
      "/history",
      "/account",
      "/analyze/results/:path*",
    ]);
  });

  it("exports a middleware function", () => {
    expect(typeof middleware).toBe("function");
  });

  it("redirects to /login when req.auth is null", () => {
    expect(__handler.current).not.toBeNull();

    const mockReq = {
      auth: null,
      url: "http://localhost:3000/history",
      nextUrl: { pathname: "/history" },
    };

    const result = __handler.current!(mockReq) as Response;
    expect(result).toBeInstanceOf(Response);
    expect(result.status).toBe(302);
    const location = result.headers.get("location");
    expect(location).toContain("/login");
    expect(location).toContain("callbackUrl=%2Fhistory");
  });

  it("passes through when req.auth exists", () => {
    expect(__handler.current).not.toBeNull();

    const mockReq = {
      auth: { user: { id: "1" } },
      url: "http://localhost:3000/history",
      nextUrl: { pathname: "/history" },
    };

    const result = __handler.current!(mockReq);
    expect(result).toBeUndefined();
  });
});
