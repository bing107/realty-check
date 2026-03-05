import React from "react";
import { render, screen } from "@testing-library/react";
import LoginPage, { metadata } from "./page";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("next-auth/react", () => ({
  signIn: jest.fn(),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock("@/lib/analytics", () => ({
  track: jest.fn(),
}));

describe("LoginPage", () => {
  it("renders Sign in heading", () => {
    render(<LoginPage />);
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("renders welcome text", () => {
    render(<LoginPage />);
    expect(screen.getByText("Welcome back to Realty Check")).toBeInTheDocument();
  });

  it("renders AuthForm in signin mode", () => {
    render(<LoginPage />);
    // AuthForm in signin mode has a "Sign in" submit button
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("exports metadata with correct title", () => {
    expect(metadata).toBeDefined();
    expect((metadata as { title: string }).title).toMatch(/Sign in/);
  });
});
