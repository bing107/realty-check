import React from "react";
import { render, screen } from "@testing-library/react";
import SignupPage, { metadata } from "./page";

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

describe("SignupPage", () => {
  it("renders Create your account heading", () => {
    render(<SignupPage />);
    expect(screen.getByText("Create your account")).toBeInTheDocument();
  });

  it("renders the description text", () => {
    render(<SignupPage />);
    expect(screen.getByText("Start analyzing real estate investments")).toBeInTheDocument();
  });

  it("renders AuthForm in signup mode", () => {
    render(<SignupPage />);
    // AuthForm in signup mode has a "Create account" submit button
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
  });

  it("exports metadata with correct title", () => {
    expect(metadata).toBeDefined();
    expect((metadata as { title: string }).title).toMatch(/Sign up/);
  });
});
