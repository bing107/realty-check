import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AuthModal from "./AuthModal";

// Mock next-auth/react
const mockSignIn = jest.fn();
jest.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
}));

describe("AuthModal", () => {
  const onClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders sign-in tab by default", () => {
    render(<AuthModal onClose={onClose} />);

    // Both "Sign in" elements should exist: tab and submit button
    const signInButtons = screen.getAllByRole("button", { name: "Sign in" });
    expect(signInButtons).toHaveLength(2);

    // The first one is the tab, which should have the active style
    expect(signInButtons[0].className).toContain("border-blue-600");

    // The second one is the form submit button
    expect(signInButtons[1]).toHaveAttribute("type", "submit");

    // Should not show the Name field (sign-in only has email + password)
    expect(screen.queryByPlaceholderText("Your name")).not.toBeInTheDocument();
  });

  it("shows sign-up tab when clicked", () => {
    render(<AuthModal onClose={onClose} />);

    const createAccountTab = screen.getByRole("button", {
      name: "Create account",
    });
    fireEvent.click(createAccountTab);

    // Name field should now be visible (sign-up form)
    expect(screen.getByPlaceholderText("Your name")).toBeInTheDocument();

    // The Create account buttons exist (tab + submit)
    const createButtons = screen.getAllByRole("button", {
      name: "Create account",
    });
    expect(createButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("shows error on failed sign-in", async () => {
    mockSignIn.mockResolvedValue({ error: "CredentialsSignin" });

    render(<AuthModal onClose={onClose} />);

    const emailInput = screen.getByPlaceholderText("you@example.com");
    const passwordInput = screen.getByPlaceholderText("--------");

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "wrongpassword" } });

    // getAllByRole returns tab first, submit second; use the form's submit
    const signInButtons = screen.getAllByRole("button", { name: "Sign in" });
    const formSubmit = signInButtons.find(
      (btn) => btn.getAttribute("type") === "submit"
    )!;
    fireEvent.click(formSubmit);

    await waitFor(() => {
      expect(screen.getByText("Invalid email or password")).toBeInTheDocument();
    });

    expect(mockSignIn).toHaveBeenCalledWith("credentials", {
      email: "test@example.com",
      password: "wrongpassword",
      redirect: false,
    });
  });

  it("calls onClose when backdrop is clicked", () => {
    const { container } = render(<AuthModal onClose={onClose} />);

    // The backdrop is the outermost div with the fixed class
    const backdrop = container.querySelector(".fixed");
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when modal content is clicked", () => {
    render(<AuthModal onClose={onClose} />);

    // Click on the form content area (email input)
    const emailInput = screen.getByPlaceholderText("you@example.com");
    fireEvent.click(emailInput);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose on successful sign-in", async () => {
    mockSignIn.mockResolvedValue({ error: null });

    render(<AuthModal onClose={onClose} />);

    const emailInput = screen.getByPlaceholderText("you@example.com");
    const passwordInput = screen.getByPlaceholderText("--------");

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "correctpass123" } });

    const signInButtons = screen.getAllByRole("button", { name: "Sign in" });
    const formSubmit = signInButtons.find(
      (btn) => btn.getAttribute("type") === "submit"
    )!;
    fireEvent.click(formSubmit);

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("renders with sign-up tab as default when specified", () => {
    render(<AuthModal onClose={onClose} defaultTab="signup" />);

    // Name field should be visible (sign-up form)
    expect(screen.getByPlaceholderText("Your name")).toBeInTheDocument();
  });
});
