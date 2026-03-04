import { isAuthEnabled } from "@/lib/auth-config";
import { NextResponse } from "next/server";

type RouteHandler = (req: Request, ...rest: unknown[]) => Promise<Response>;

async function getHandlers(): Promise<{ GET: RouteHandler; POST: RouteHandler }> {
  if (!isAuthEnabled) {
    return {
      GET: () =>
        Promise.resolve(
          NextResponse.json({ error: "Auth not configured" }, { status: 404 })
        ),
      POST: () =>
        Promise.resolve(
          NextResponse.json({ error: "Auth not configured" }, { status: 404 })
        ),
    };
  }
  const { handlers } = await import("@/auth");
  return handlers as unknown as { GET: RouteHandler; POST: RouteHandler };
}

export async function GET(req: Request, ctx: unknown) {
  const { GET: handler } = await getHandlers();
  return handler(req, ctx);
}

export async function POST(req: Request, ctx: unknown) {
  const { POST: handler } = await getHandlers();
  return handler(req, ctx);
}
