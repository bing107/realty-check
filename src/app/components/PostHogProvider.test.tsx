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

// Separate describe block to test PostHogPageView with non-empty search params
describe("PostHogPageView with search params", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("appends query string to URL when searchParams is non-empty (line 16)", () => {
    const navModule = jest.requireMock("next/navigation") as {
      usePathname: () => string | null;
      useSearchParams: () => URLSearchParams;
    };
    const originalUseSearchParams = navModule.useSearchParams;
    navModule.useSearchParams = () => new URLSearchParams("foo=bar&baz=qux");

    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";

    render(
      <PostHogProvider>
        <div>Content With Params</div>
      </PostHogProvider>
    );

    expect(screen.getByText("Content With Params")).toBeInTheDocument();
    // posthog.capture should have been called with a URL containing the query string
    expect(mockCapture).toHaveBeenCalledWith("$pageview", {
      "$current_url": expect.stringContaining("?foo=bar&baz=qux"),
    });

    // Restore original mock
    navModule.useSearchParams = originalUseSearchParams;
  });

  it("does not capture pageview when pathname is null (line 13)", () => {
    const navModule = jest.requireMock("next/navigation") as {
      usePathname: () => string | null;
      useSearchParams: () => URLSearchParams;
    };
    const originalUsePathname = navModule.usePathname;
    navModule.usePathname = () => null;

    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";

    render(
      <PostHogProvider>
        <div>Null Pathname</div>
      </PostHogProvider>
    );

    expect(screen.getByText("Null Pathname")).toBeInTheDocument();
    // posthog.capture should NOT have been called since pathname is null
    expect(mockCapture).not.toHaveBeenCalled();

    // Restore original mock
    navModule.usePathname = originalUsePathname;
  });
});
