import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AuthForm from "./AuthForm";

const mockPush = jest.fn();
const mockSignIn = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
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
});
