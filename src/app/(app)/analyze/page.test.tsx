import React from "react";
import { render, screen } from "@testing-library/react";
import AnalyzePage from "./page";

jest.mock("next-auth/react", () => ({
  useSession: () => ({ data: null, status: "unauthenticated" }),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/analyze",
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock("@/lib/auth-config", () => ({
  AUTH_ENABLED: false,
  STRIPE_ENABLED: false,
}));

jest.mock("@/lib/analytics", () => ({
  track: jest.fn(),
}));

// Mock child components to isolate the page
jest.mock("@/app/components/UploadZone", () => ({
  __esModule: true,
  default: ({ onFilesChange }: { onFilesChange: (f: File[]) => void }) => (
    <div data-testid="upload-zone">UploadZone</div>
  ),
}));

jest.mock("@/app/components/ApiKeyInput", () => ({
  __esModule: true,
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input data-testid="api-key-input" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

jest.mock("@/app/components/ResultsDashboard", () => ({
  __esModule: true,
  default: () => <div data-testid="results-dashboard">ResultsDashboard</div>,
}));

jest.mock("@/app/components/UsageDisplay", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/app/components/UpgradePrompt", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/app/components/WizardStepIndicator", () => ({
  __esModule: true,
  default: ({ currentStep }: { currentStep: string }) => (
    <div data-testid="wizard-step">{currentStep}</div>
  ),
}));

describe("AnalyzePage", () => {
  it("renders without crashing", () => {
    render(<AnalyzePage />);
    expect(screen.getByText("Analyze Property")).toBeInTheDocument();
  });

  it("shows upload step initially", () => {
    render(<AnalyzePage />);
    expect(screen.getByTestId("wizard-step")).toHaveTextContent("upload");
  });

  it("renders the Analyze Documents button (disabled by default)", () => {
    render(<AnalyzePage />);
    const button = screen.getByRole("button", { name: "Analyze Documents" });
    expect(button).toBeDisabled();
  });

  it("renders UploadZone component", () => {
    render(<AnalyzePage />);
    expect(screen.getByTestId("upload-zone")).toBeInTheDocument();
  });

  it("renders ApiKeyInput component", () => {
    render(<AnalyzePage />);
    expect(screen.getByTestId("api-key-input")).toBeInTheDocument();
  });

  it("renders subtitle text", () => {
    render(<AnalyzePage />);
    expect(screen.getByText("Upload broker documents for AI-powered investment analysis")).toBeInTheDocument();
  });
});
