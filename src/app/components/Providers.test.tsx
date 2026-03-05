import React from "react";
import { render, screen } from "@testing-library/react";
import Providers from "./Providers";

jest.mock("next-auth/react", () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="session-provider">{children}</div>
  ),
}));

jest.mock("./PostHogProvider", () => ({
  PostHogProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="posthog-provider">{children}</div>
  ),
}));

describe("Providers", () => {
  it("renders children wrapped in SessionProvider and PostHogProvider", () => {
    render(
      <Providers>
        <div>App Content</div>
      </Providers>
    );

    expect(screen.getByText("App Content")).toBeInTheDocument();
    expect(screen.getByTestId("session-provider")).toBeInTheDocument();
    expect(screen.getByTestId("posthog-provider")).toBeInTheDocument();
  });
});
