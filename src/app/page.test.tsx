import React from "react";
import { render, screen } from "@testing-library/react";
import LandingPage from "./page";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("LandingPage", () => {
  it("renders the main heading", () => {
    render(<LandingPage />);
    expect(screen.getByText("Know Before You Buy")).toBeInTheDocument();
  });

  it("renders the Analyze a Property link", () => {
    render(<LandingPage />);
    const link = screen.getByText("Analyze a Property");
    expect(link.closest("a")).toHaveAttribute("href", "/analyze");
  });

  it("renders feature sections", () => {
    render(<LandingPage />);
    expect(screen.getByText("Document Extraction")).toBeInTheDocument();
    expect(screen.getByText("AI Analysis")).toBeInTheDocument();
    expect(screen.getByText("Financial Metrics")).toBeInTheDocument();
    expect(screen.getByText("Investment Report")).toBeInTheDocument();
  });
});
