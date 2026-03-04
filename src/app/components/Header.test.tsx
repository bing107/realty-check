import React from "react";
import { render, screen } from "@testing-library/react";
import Header from "./Header";

// Mock next-auth/react
jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
}));

// Mock auth-config
jest.mock("@/lib/auth-config", () => ({
  AUTH_ENABLED: true,
}));

// Mock UserMenu to simplify testing
jest.mock("./UserMenu", () => {
  return function MockUserMenu({ user }: { user: { name?: string } }) {
    return <div data-testid="user-menu">{user.name || "User"}</div>;
  };
});

import { useSession } from "next-auth/react";

const mockUseSession = useSession as jest.Mock;

describe("Header", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders 'Realty Check' link", () => {
    mockUseSession.mockReturnValue({ data: null });

    render(<Header />);
    const link = screen.getByText("Realty Check");
    expect(link).toBeInTheDocument();
    expect(link.closest("a")).toHaveAttribute("href", "/");
  });

  it("shows 'Pricing' link", () => {
    mockUseSession.mockReturnValue({ data: null });

    render(<Header />);
    const link = screen.getByText("Pricing");
    expect(link).toBeInTheDocument();
    expect(link.closest("a")).toHaveAttribute("href", "/pricing");
  });

  it("shows Sign in and Sign up links when not authenticated", () => {
    mockUseSession.mockReturnValue({ data: null });

    render(<Header />);
    expect(screen.getByText("Sign in")).toBeInTheDocument();
    expect(screen.getByText("Sign up")).toBeInTheDocument();
    expect(screen.queryByTestId("user-menu")).not.toBeInTheDocument();
  });

  it("shows Sign in link pointing to /login", () => {
    mockUseSession.mockReturnValue({ data: null });

    render(<Header />);
    const signInLink = screen.getByText("Sign in");
    expect(signInLink.closest("a")).toHaveAttribute("href", "/login");
  });

  it("shows Sign up link pointing to /signup", () => {
    mockUseSession.mockReturnValue({ data: null });

    render(<Header />);
    const signUpLink = screen.getByText("Sign up");
    expect(signUpLink.closest("a")).toHaveAttribute("href", "/signup");
  });

  it("shows UserMenu when authenticated, not sign in/up buttons", () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { name: "Test User", email: "test@example.com" },
      },
    });

    render(<Header />);
    expect(screen.getByTestId("user-menu")).toBeInTheDocument();
    expect(screen.queryByText("Sign in")).not.toBeInTheDocument();
    expect(screen.queryByText("Sign up")).not.toBeInTheDocument();
  });

  it("shows History link for authenticated users", () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { name: "Test User", email: "test@example.com" },
      },
    });

    render(<Header />);
    const historyLink = screen.getByText("History");
    expect(historyLink).toBeInTheDocument();
    expect(historyLink.closest("a")).toHaveAttribute("href", "/history");
  });

  it("does not show History link for unauthenticated users", () => {
    mockUseSession.mockReturnValue({ data: null });

    render(<Header />);
    expect(screen.queryByText("History")).not.toBeInTheDocument();
  });
});
