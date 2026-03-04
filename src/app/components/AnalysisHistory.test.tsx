import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AnalysisHistory from "./AnalysisHistory";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

function makeAnalysis(overrides = {}) {
  return {
    id: "analysis-1",
    filename: "test-property.pdf",
    createdAt: "2026-01-15T10:30:00.000Z",
    analysisJson: '{"summary":"test"}',
    metrics: null,
    summary: null,
    ...overrides,
  };
}

describe("AnalysisHistory", () => {
  const onView = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders nothing when loading", () => {
    // fetch never resolves, so loading stays true
    mockFetch.mockReturnValue(new Promise(() => {}));

    const { container } = render(<AnalysisHistory onView={onView} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when no analyses", async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ analyses: [] }),
    });

    const { container } = render(<AnalysisHistory onView={onView} />);

    await waitFor(() => {
      expect(container.innerHTML).toBe("");
    });
  });

  it("renders analysis list when data is available", async () => {
    const analyses = [
      makeAnalysis({ id: "a1", filename: "property-one.pdf" }),
      makeAnalysis({ id: "a2", filename: "property-two.pdf" }),
    ];

    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ analyses }),
    });

    render(<AnalysisHistory onView={onView} />);

    await waitFor(() => {
      expect(screen.getByText("property-one.pdf")).toBeInTheDocument();
    });
    expect(screen.getByText("property-two.pdf")).toBeInTheDocument();
    expect(screen.getByText(/Past analyses \(2\)/)).toBeInTheDocument();
  });

  it("shows metric preview when metrics are present", async () => {
    const analyses = [
      makeAnalysis({
        id: "a1",
        filename: "good-deal.pdf",
        metrics: JSON.stringify({ grossYield: 0.065, monthlyNet: 250 }),
      }),
    ];

    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ analyses }),
    });

    render(<AnalysisHistory onView={onView} />);

    await waitFor(() => {
      expect(screen.getByText("good-deal.pdf")).toBeInTheDocument();
    });

    // Check for yield and monthly net display
    // The format is "6.5% yield" and "+\u20AC250/mo" joined by " \u00B7 "
    expect(screen.getByText(/6\.5% yield/)).toBeInTheDocument();
    expect(screen.getByText(/250\/mo/)).toBeInTheDocument();
  });

  it("calls onView with correct data when View button clicked", async () => {
    const analysis = makeAnalysis({
      id: "a1",
      filename: "my-property.pdf",
    });

    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ analyses: [analysis] }),
    });

    render(<AnalysisHistory onView={onView} />);

    await waitFor(() => {
      expect(screen.getByText("my-property.pdf")).toBeInTheDocument();
    });

    const viewButton = screen.getByRole("button", { name: "View" });
    fireEvent.click(viewButton);

    expect(onView).toHaveBeenCalledTimes(1);
    expect(onView).toHaveBeenCalledWith(analysis);
  });

  it("shows 'Untitled analysis' when filename is null", async () => {
    const analyses = [
      makeAnalysis({ id: "a1", filename: null }),
    ];

    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ analyses }),
    });

    render(<AnalysisHistory onView={onView} />);

    await waitFor(() => {
      expect(screen.getByText("Untitled analysis")).toBeInTheDocument();
    });
  });

  it("re-fetches when refreshKey changes", async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ analyses: [] }),
    });

    const { rerender } = render(
      <AnalysisHistory onView={onView} refreshKey={0} />
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          analyses: [makeAnalysis({ id: "a-new" })],
        }),
    });

    rerender(<AnalysisHistory onView={onView} refreshKey={1} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  it("handles fetch error gracefully (line 34)", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const { container } = render(<AnalysisHistory onView={onView} />);

    await waitFor(() => {
      // After error, loading becomes false and analyses is empty, so renders nothing
      expect(container.innerHTML).toBe("");
    });
  });

  it("toggles open/close when header button is clicked (lines 61-68)", async () => {
    const analyses = [
      makeAnalysis({ id: "a1", filename: "property-one.pdf" }),
    ];

    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ analyses }),
    });

    render(<AnalysisHistory onView={onView} />);

    await waitFor(() => {
      expect(screen.getByText("property-one.pdf")).toBeInTheDocument();
    });

    // Click to close
    const toggleButton = screen.getByText(/Past analyses/);
    fireEvent.click(toggleButton);

    // After closing, the file name should no longer be visible
    expect(screen.queryByText("property-one.pdf")).not.toBeInTheDocument();

    // Click to re-open
    fireEvent.click(toggleButton);
    expect(screen.getByText("property-one.pdf")).toBeInTheDocument();
  });

  it("shows negative monthly net with no plus sign", async () => {
    const analyses = [
      makeAnalysis({
        id: "a1",
        filename: "negative.pdf",
        metrics: JSON.stringify({ grossYield: 0.04, monthlyNet: -200 }),
      }),
    ];

    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ analyses }),
    });

    render(<AnalysisHistory onView={onView} />);

    await waitFor(() => {
      expect(screen.getByText("negative.pdf")).toBeInTheDocument();
    });

    expect(screen.getByText(/4\.0% yield/)).toBeInTheDocument();
    expect(screen.getByText(/-200\/mo/)).toBeInTheDocument();
  });

  it("returns null preview for invalid JSON metrics", async () => {
    const analyses = [
      makeAnalysis({
        id: "a1",
        filename: "bad-metrics.pdf",
        metrics: "not-valid-json",
      }),
    ];

    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ analyses }),
    });

    render(<AnalysisHistory onView={onView} />);

    await waitFor(() => {
      expect(screen.getByText("bad-metrics.pdf")).toBeInTheDocument();
    });
    // No metric preview text should appear since JSON parsing failed
  });
});
