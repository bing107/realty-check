import React from "react";
import { render, screen } from "@testing-library/react";
import WizardStepIndicator from "./WizardStepIndicator";

describe("WizardStepIndicator", () => {
  it("renders all 4 steps", () => {
    render(<WizardStepIndicator currentStep="upload" />);

    expect(screen.getByText("Upload")).toBeInTheDocument();
    expect(screen.getByText("Extract")).toBeInTheDocument();
    expect(screen.getByText("AI Analysis")).toBeInTheDocument();
    expect(screen.getByText("Report")).toBeInTheDocument();
  });

  it("shows first step active for 'upload' state", () => {
    render(<WizardStepIndicator currentStep="upload" />);

    // The active step gets ring-4 ring-blue-100 styling
    // Step 1 (Upload) should be active with ring
    const uploadStep = screen.getByText("Upload");
    expect(uploadStep).toHaveClass("text-blue-600");

    // Other steps should be inactive (gray)
    expect(screen.getByText("Extract")).toHaveClass("text-gray-400");
    expect(screen.getByText("AI Analysis")).toHaveClass("text-gray-400");
    expect(screen.getByText("Report")).toHaveClass("text-gray-400");
  });

  it("shows second step active for 'extracted' state", () => {
    render(<WizardStepIndicator currentStep="extracted" />);

    // Upload step should be completed (gray-600)
    expect(screen.getByText("Upload")).toHaveClass("text-gray-600");
    // Extract step should be active (blue-600)
    expect(screen.getByText("Extract")).toHaveClass("text-blue-600");
  });

  it("shows third step active for 'analyzed' state", () => {
    render(<WizardStepIndicator currentStep="analyzed" />);

    expect(screen.getByText("Upload")).toHaveClass("text-gray-600");
    expect(screen.getByText("Extract")).toHaveClass("text-gray-600");
    expect(screen.getByText("AI Analysis")).toHaveClass("text-blue-600");
    expect(screen.getByText("Report")).toHaveClass("text-gray-400");
  });

  it("shows fourth step active for 'report' state", () => {
    render(<WizardStepIndicator currentStep="report" />);

    // All previous steps should be completed
    expect(screen.getByText("Upload")).toHaveClass("text-gray-600");
    expect(screen.getByText("Extract")).toHaveClass("text-gray-600");
    expect(screen.getByText("AI Analysis")).toHaveClass("text-gray-600");
    // Report step active
    expect(screen.getByText("Report")).toHaveClass("text-blue-600");
  });

  it("completed steps show checkmark SVG", () => {
    const { container } = render(<WizardStepIndicator currentStep="report" />);

    // With report active, first 3 steps are completed and should show SVG checkmarks
    const svgs = container.querySelectorAll("svg");
    expect(svgs).toHaveLength(3);
  });

  it("shows '...' label for extracting processing state", () => {
    render(<WizardStepIndicator currentStep="extracting" />);

    // The "extracting" state maps to step 0 (Upload), and isProcessing is true
    expect(screen.getByText("Upload...")).toBeInTheDocument();
  });

  it("shows '...' label for analyzing processing state", () => {
    render(<WizardStepIndicator currentStep="analyzing" />);

    // The "analyzing" state maps to step 1 (Extract), and isProcessing is true
    expect(screen.getByText("Extract...")).toBeInTheDocument();
  });

  it("does not show '...' for non-processing states", () => {
    render(<WizardStepIndicator currentStep="upload" />);

    expect(screen.queryByText("Upload...")).not.toBeInTheDocument();
    expect(screen.getByText("Upload")).toBeInTheDocument();
  });

  it("falls back to step index 0 for unknown step values (line 18)", () => {
    // Force an unknown step value to test the fallback return 0 in getStepIndex
    render(<WizardStepIndicator currentStep={"unknown" as never} />);
    // It should default to step index 0 (Upload active)
    expect(screen.getByText("Upload")).toHaveClass("text-blue-600");
  });
});
