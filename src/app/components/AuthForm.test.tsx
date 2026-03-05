import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AuthForm from "./AuthForm";

const mockPush = jest.fn();
const mockSignIn = jest.fn();

let mockSearchParams = new URLSearchParams();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}));

jest.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
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

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("AuthForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
  });

  describe("signin mode", () => {
    it("renders email and password fields", () => {
      render(<AuthForm mode="signin" />);
      expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("--------")).toBeInTheDocument();
    });

    it("has Sign in button", () => {
      render(<AuthForm mode="signin" />);
      expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
    });

    it("calls signIn with credentials on submit", async () => {
      mockSignIn.mockResolvedValue({ error: null });
      render(<AuthForm mode="signin" />);

      fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
        target: { value: "test@test.com" },
      });
      fireEvent.change(screen.getByPlaceholderText("--------"), {
        target: { value: "password123" },
      });
      fireEvent.submit(screen.getByRole("button", { name: /sign in/i }));

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith("credentials", {
          email: "test@test.com",
          password: "password123",
          redirect: false,
        });
      });
    });

    it("shows error when signIn returns error", async () => {
      mockSignIn.mockResolvedValue({ error: "Invalid credentials" });
      render(<AuthForm mode="signin" />);

      fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
        target: { value: "test@test.com" },
      });
      fireEvent.change(screen.getByPlaceholderText("--------"), {
        target: { value: "wrong" },
      });
      fireEvent.submit(screen.getByRole("button", { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText("Invalid email or password")).toBeInTheDocument();
      });
    });

    it("redirects on success", async () => {
      mockSignIn.mockResolvedValue({ error: null });
      render(<AuthForm mode="signin" />);

      fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
        target: { value: "test@test.com" },
      });
      fireEvent.change(screen.getByPlaceholderText("--------"), {
        target: { value: "password123" },
      });
      fireEvent.submit(screen.getByRole("button", { name: /sign in/i }));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/analyze");
      });
    });
  });

  describe("signup mode", () => {
    it("renders name, email, and password fields", () => {
      render(<AuthForm mode="signup" />);
      expect(screen.getByPlaceholderText("Your name")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Min. 8 characters")).toBeInTheDocument();
    });

    it("has Create account button", () => {
      render(<AuthForm mode="signup" />);
      expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
    });

    it("calls fetch then signIn on successful signup", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "user-1" }),
      });
      mockSignIn.mockResolvedValue({ error: null });

      render(<AuthForm mode="signup" />);

      fireEvent.change(screen.getByPlaceholderText("Your name"), {
        target: { value: "Test User" },
      });
      fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
        target: { value: "test@test.com" },
      });
      fireEvent.change(screen.getByPlaceholderText("Min. 8 characters"), {
        target: { value: "password123" },
      });
      fireEvent.submit(screen.getByRole("button", { name: /create account/i }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/auth/signup", expect.anything());
        expect(mockSignIn).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/analyze");
      });
    });

    it("shows 'Sign up failed' fallback when API returns no error message (line 58)", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      render(<AuthForm mode="signup" />);

      fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
        target: { value: "test@test.com" },
      });
      fireEvent.change(screen.getByPlaceholderText("Min. 8 characters"), {
        target: { value: "password123" },
      });
      fireEvent.submit(screen.getByRole("button", { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText("Sign up failed")).toBeInTheDocument();
      });
    });

    it("shows error from API response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Email exists" }),
      });

      render(<AuthForm mode="signup" />);

      fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
        target: { value: "test@test.com" },
      });
      fireEvent.change(screen.getByPlaceholderText("Min. 8 characters"), {
        target: { value: "password123" },
      });
      fireEvent.submit(screen.getByRole("button", { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText("Email exists")).toBeInTheDocument();
      });
    });

    it("shows error when signIn fails after signup", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "user-1" }),
      });
      mockSignIn.mockResolvedValue({ error: "Some error" });

      render(<AuthForm mode="signup" />);

      fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
        target: { value: "test@test.com" },
      });
      fireEvent.change(screen.getByPlaceholderText("Min. 8 characters"), {
        target: { value: "password123" },
      });
      fireEvent.submit(screen.getByRole("button", { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText("Account created. Please sign in.")).toBeInTheDocument();
      });
    });

    it("shows generic error on fetch exception", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      render(<AuthForm mode="signup" />);

      fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
        target: { value: "test@test.com" },
      });
      fireEvent.change(screen.getByPlaceholderText("Min. 8 characters"), {
        target: { value: "password123" },
      });
      fireEvent.submit(screen.getByRole("button", { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText("Sign up failed. Please try again.")).toBeInTheDocument();
      });
    });
  });

  describe("callbackUrl safety", () => {
    it("rejects callbackUrl starting with // (open redirect protection) in signin mode", async () => {
      mockSearchParams = new URLSearchParams("callbackUrl=//evil.com");
      mockSignIn.mockResolvedValue({ error: null });

      render(<AuthForm mode="signin" />);

      fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
        target: { value: "test@test.com" },
      });
      fireEvent.change(screen.getByPlaceholderText("--------"), {
        target: { value: "password123" },
      });
      fireEvent.submit(screen.getByRole("button", { name: /sign in/i }));

      await waitFor(() => {
        // Should redirect to /analyze (default), not //evil.com
        expect(mockPush).toHaveBeenCalledWith("/analyze");
      });
    });

    it("rejects callbackUrl starting with // in signup mode", async () => {
      mockSearchParams = new URLSearchParams("callbackUrl=//evil.com");
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "user-1" }),
      });
      mockSignIn.mockResolvedValue({ error: null });

      render(<AuthForm mode="signup" />);

      fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
        target: { value: "test@test.com" },
      });
      fireEvent.change(screen.getByPlaceholderText("Min. 8 characters"), {
        target: { value: "password123" },
      });
      fireEvent.submit(screen.getByRole("button", { name: /create account/i }));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/analyze");
      });
    });

    it("includes callbackUrl in sign-up link when it differs from /analyze", () => {
      mockSearchParams = new URLSearchParams("callbackUrl=/pricing");
      render(<AuthForm mode="signin" />);

      const signUpLink = screen.getByText("Sign up");
      expect(signUpLink.closest("a")).toHaveAttribute(
        "href",
        expect.stringContaining("callbackUrl=%2Fpricing")
      );
    });

    it("includes callbackUrl in sign-in link when it differs from /analyze", () => {
      mockSearchParams = new URLSearchParams("callbackUrl=/pricing");
      render(<AuthForm mode="signup" />);

      const signInLink = screen.getByText("Sign in");
      expect(signInLink.closest("a")).toHaveAttribute(
        "href",
        expect.stringContaining("callbackUrl=%2Fpricing")
      );
    });

    it("does not include callbackUrl in sign-up link when it is /analyze", () => {
      render(<AuthForm mode="signin" />);

      const signUpLink = screen.getByText("Sign up");
      expect(signUpLink.closest("a")).toHaveAttribute("href", "/signup");
    });
  });
});
