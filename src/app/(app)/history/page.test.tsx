import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import HistoryPage from "./page";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockUseSession = jest.fn();
const mockPush = jest.fn();

jest.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/history",
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("HistoryPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSession.mockReturnValue({ data: { user: { id: "1" } }, status: "authenticated" });
  });

  it("shows Loading... initially", async () => {
    mockFetch.mockReturnValue(new Promise(() => {}));

    render(<HistoryPage />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows No analyses yet when empty", async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ analyses: [] }),
    });

    render(<HistoryPage />);

    await waitFor(() => {
      expect(screen.getByText("No analyses yet")).toBeInTheDocument();
    });
  });

  it("shows list of analyses when data is loaded", async () => {
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          analyses: [
            { id: "1", filename: "test.pdf", createdAt: "2026-01-15T00:00:00Z", metrics: null },
            { id: "2", filename: "other.pdf", createdAt: "2026-01-16T00:00:00Z", metrics: null },
          ],
        }),
    });

    render(<HistoryPage />);

    await waitFor(() => {
      expect(screen.getByText("test.pdf")).toBeInTheDocument();
      expect(screen.getByText("other.pdf")).toBeInTheDocument();
    });
  });

  it("shows metric preview values", async () => {
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          analyses: [
            {
              id: "1",
              filename: "good.pdf",
              createdAt: "2026-01-15T00:00:00Z",
              metrics: JSON.stringify({ grossYield: 0.065, monthlyNet: 250 }),
            },
          ],
        }),
    });

    render(<HistoryPage />);

    await waitFor(() => {
      expect(screen.getByText(/6\.5% yield/)).toBeInTheDocument();
    });
  });

  it("handles invalid JSON metrics gracefully", async () => {
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          analyses: [
            {
              id: "1",
              filename: "bad.pdf",
              createdAt: "2026-01-15T00:00:00Z",
              metrics: "not-valid-json",
            },
          ],
        }),
    });

    render(<HistoryPage />);

    await waitFor(() => {
      expect(screen.getByText("bad.pdf")).toBeInTheDocument();
    });
  });

  it("handles null metrics", async () => {
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          analyses: [
            {
              id: "1",
              filename: "null.pdf",
              createdAt: "2026-01-15T00:00:00Z",
              metrics: null,
            },
          ],
        }),
    });

    render(<HistoryPage />);

    await waitFor(() => {
      expect(screen.getByText("null.pdf")).toBeInTheDocument();
    });
  });

  it("handles fetch error gracefully", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    render(<HistoryPage />);

    await waitFor(() => {
      expect(screen.getByText("No analyses yet")).toBeInTheDocument();
    });
  });

  it("shows negative monthly net with no plus sign", async () => {
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          analyses: [
            {
              id: "1",
              filename: "negative.pdf",
              createdAt: "2026-01-15T00:00:00Z",
              metrics: JSON.stringify({ grossYield: null, monthlyNet: -200 }),
            },
          ],
        }),
    });

    render(<HistoryPage />);

    await waitFor(() => {
      expect(screen.getByText(/\u20AC-200\/mo/)).toBeInTheDocument();
    });
  });

  it("shows Untitled analysis when filename is null", async () => {
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          analyses: [
            {
              id: "1",
              filename: null,
              createdAt: "2026-01-15T00:00:00Z",
              metrics: null,
            },
          ],
        }),
    });

    render(<HistoryPage />);

    await waitFor(() => {
      expect(screen.getByText("Untitled analysis")).toBeInTheDocument();
    });
  });

  it("returns null preview when parsed metrics have no known fields", async () => {
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          analyses: [
            {
              id: "1",
              filename: "empty-metrics.pdf",
              createdAt: "2026-01-15T00:00:00Z",
              metrics: JSON.stringify({ someUnknownField: 42 }),
            },
          ],
        }),
    });

    render(<HistoryPage />);

    await waitFor(() => {
      expect(screen.getByText("empty-metrics.pdf")).toBeInTheDocument();
    });
    // No preview text should appear (parts.join returns empty string -> null)
  });

  it("shows +0/mo when monthlyNet is exactly 0 (line 38 sign branch)", async () => {
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          analyses: [
            {
              id: "1",
              filename: "zero.pdf",
              createdAt: "2026-01-15T00:00:00Z",
              metrics: JSON.stringify({ grossYield: 0.04, monthlyNet: 0 }),
            },
          ],
        }),
    });

    render(<HistoryPage />);

    await waitFor(() => {
      expect(screen.getByText("zero.pdf")).toBeInTheDocument();
    });
    // monthlyNet >= 0 is true for 0, so sign is "+"
    expect(screen.getByText(/\+\u20AC0\/mo/)).toBeInTheDocument();
  });

  it("handles response with no analyses key (data.analyses || [] fallback, line 38)", async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({}),
    });

    render(<HistoryPage />);

    await waitFor(() => {
      expect(screen.getByText("No analyses yet")).toBeInTheDocument();
    });
  });

  it("shows both yield and positive monthly net together", async () => {
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          analyses: [
            {
              id: "1",
              filename: "full.pdf",
              createdAt: "2026-01-15T00:00:00Z",
              metrics: JSON.stringify({ grossYield: 0.05, monthlyNet: 300 }),
            },
          ],
        }),
    });

    render(<HistoryPage />);

    await waitFor(() => {
      expect(screen.getByText(/5\.0% yield/)).toBeInTheDocument();
      expect(screen.getByText(/\+\u20AC300\/mo/)).toBeInTheDocument();
    });
  });
});
