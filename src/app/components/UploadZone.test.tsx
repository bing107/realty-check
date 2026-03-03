/**
 * Unit tests for the UploadZone component.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import UploadZone from "./UploadZone";

describe("UploadZone", () => {
  const noop = jest.fn();

  beforeEach(() => {
    noop.mockClear();
  });

  it("renders without crashing", () => {
    const { container } = render(<UploadZone onFilesChange={noop} />);
    expect(container).toBeTruthy();
  });

  it("shows the drop zone instruction text", () => {
    render(<UploadZone onFilesChange={noop} />);
    expect(
      screen.getByText(/drag & drop pdf files here/i)
    ).toBeInTheDocument();
  });

  it("shows the file type and size constraint text", () => {
    render(<UploadZone onFilesChange={noop} />);
    expect(
      screen.getByText(/pdf only, up to 20 mb per file/i)
    ).toBeInTheDocument();
  });

  it("does not render any file items initially", () => {
    const { container } = render(<UploadZone onFilesChange={noop} />);
    const fileList = container.querySelector(".mt-6.space-y-2");
    expect(fileList).toBeNull();
  });

  it("calls onFilesChange with empty array on initial render", () => {
    render(<UploadZone onFilesChange={noop} />);
    expect(noop).toHaveBeenCalledWith([]);
  });

  it("renders a hidden file input with PDF accept attribute", () => {
    const { container } = render(<UploadZone onFilesChange={noop} />);
    const input = container.querySelector("input[type='file']") as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.accept).toContain("application/pdf");
  });
});
