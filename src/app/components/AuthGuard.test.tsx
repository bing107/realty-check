import React from "react";
import { render, screen } from "@testing-library/react";
import AuthGuard from "./AuthGuard";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/test-path",
}));

const mockUseSession = jest.fn();

jest.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}));

describe("AuthGuard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders children when authenticated", () => {
    mockUseSession.mockReturnValue({ data: { user: { id: "1" } }, status: "authenticated" });

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });

  it("returns null when loading", () => {
    mockUseSession.mockReturnValue({ data: null, status: "loading" });

    const { container } = render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    expect(container.innerHTML).toBe("");
  });

  it("returns null and redirects when unauthenticated", () => {
    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });

    const { container } = render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    expect(container.innerHTML).toBe("");
    expect(mockPush).toHaveBeenCalledWith("/login?callbackUrl=%2Ftest-path");
  });
});
