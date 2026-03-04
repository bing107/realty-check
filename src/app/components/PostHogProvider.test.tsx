import React from "react";
import { render, screen } from "@testing-library/react";

const mockInit = jest.fn();
const mockCapture = jest.fn();

jest.mock("posthog-js", () => ({
  __esModule: true,
  default: {
    init: (...args: unknown[]) => mockInit(...args),
    capture: (...args: unknown[]) => mockCapture(...args),
  },
}));

jest.mock("posthog-js/react", () => ({
  PostHogProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="ph-provider">{children}</div>
  ),
}));

jest.mock("next/navigation", () => ({
  usePathname: () => "/test",
  useSearchParams: () => new URLSearchParams(),
}));

import { PostHogProvider } from "./PostHogProvider";

describe("PostHogProvider", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("renders children directly when no NEXT_PUBLIC_POSTHOG_KEY", () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;

    render(
      <PostHogProvider>
        <div>Child Content</div>
      </PostHogProvider>
    );

    expect(screen.getByText("Child Content")).toBeInTheDocument();
    // Without key, it should not wrap in PHProvider
    expect(screen.queryByTestId("ph-provider")).not.toBeInTheDocument();
  });

  it("renders PHProvider when key is set", () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";

    render(
      <PostHogProvider>
        <div>Child Content</div>
      </PostHogProvider>
    );

    expect(screen.getByText("Child Content")).toBeInTheDocument();
    expect(screen.getByTestId("ph-provider")).toBeInTheDocument();
  });
});
