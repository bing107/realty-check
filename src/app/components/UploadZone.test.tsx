/**
 * Unit tests for the UploadZone component.
 */

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import UploadZone from "./UploadZone";

// Capture the onDrop callback and control isDragActive
let capturedOnDrop: ((files: File[]) => void) | undefined;
let isDragActiveState = false;

jest.mock("react-dropzone", () => ({
  useDropzone: (opts: { onDrop: (files: File[]) => void }) => {
    capturedOnDrop = opts.onDrop;
    return {
      getRootProps: () => ({ "data-testid": "dropzone" }),
      getInputProps: () => ({ type: "file", accept: "application/pdf" }),
      isDragActive: isDragActiveState,
    };
  },
}));

function makeFile(name: string, size: number): File {
  const content = new Uint8Array(size);
  return new File([content], name, { type: "application/pdf" });
}

describe("UploadZone", () => {
  const noop = jest.fn();

  beforeEach(() => {
    noop.mockClear();
    isDragActiveState = false;
    capturedOnDrop = undefined;
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
    // No file list rendered
    expect(container.querySelector("[aria-label='Remove file']")).toBeNull();
  });

  it("calls onFilesChange with empty array on initial render", () => {
    render(<UploadZone onFilesChange={noop} />);
    expect(noop).toHaveBeenCalledWith([]);
  });

  it("renders a hidden file input with PDF accept attribute", () => {
    const { container } = render(<UploadZone onFilesChange={noop} />);
    const input = container.querySelector(
      "input[type='file']"
    ) as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.accept).toContain("application/pdf");
  });

  // formatFileSize coverage
  it("shows file size in B for files < 1024 bytes", () => {
    render(<UploadZone onFilesChange={noop} />);
    const file = makeFile("tiny.pdf", 500);

    act(() => {
      capturedOnDrop!([file]);
    });

    expect(screen.getByText("500 B")).toBeInTheDocument();
  });

  it("shows file size in KB for files < 1MB", () => {
    render(<UploadZone onFilesChange={noop} />);
    const file = makeFile("medium.pdf", 5120);

    act(() => {
      capturedOnDrop!([file]);
    });

    expect(screen.getByText("5.0 KB")).toBeInTheDocument();
  });

  it("shows file size in MB for files >= 1MB", () => {
    render(<UploadZone onFilesChange={noop} />);
    const file = makeFile("large.pdf", 2 * 1024 * 1024);

    act(() => {
      capturedOnDrop!([file]);
    });

    expect(screen.getByText("2.0 MB")).toBeInTheDocument();
  });

  // onDrop callback
  it("adds files when dropped", () => {
    render(<UploadZone onFilesChange={noop} />);
    const file = makeFile("test.pdf", 1000);

    act(() => {
      capturedOnDrop!([file]);
    });

    expect(screen.getByText("test.pdf")).toBeInTheDocument();
    // onFilesChange should be called with the file
    expect(noop).toHaveBeenLastCalledWith([file]);
  });

  it("filters out oversized files", () => {
    render(<UploadZone onFilesChange={noop} />);
    const smallFile = makeFile("small.pdf", 1000);
    const oversizedFile = makeFile("huge.pdf", 21 * 1024 * 1024);

    act(() => {
      capturedOnDrop!([smallFile, oversizedFile]);
    });

    expect(screen.getByText("small.pdf")).toBeInTheDocument();
    expect(screen.queryByText("huge.pdf")).not.toBeInTheDocument();
  });

  // removeFile
  it("removes a file when remove button is clicked", () => {
    render(<UploadZone onFilesChange={noop} />);
    const file = makeFile("removable.pdf", 1000);

    act(() => {
      capturedOnDrop!([file]);
    });

    expect(screen.getByText("removable.pdf")).toBeInTheDocument();

    const removeButton = screen.getByLabelText("Remove file");
    act(() => {
      fireEvent.click(removeButton);
    });

    expect(screen.queryByText("removable.pdf")).not.toBeInTheDocument();
  });

  // isDragActive state
  it("shows drag active text when isDragActive is true", () => {
    isDragActiveState = true;
    render(<UploadZone onFilesChange={noop} />);
    expect(
      screen.getByText("Drop your PDF files here")
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/drag & drop pdf files here/i)
    ).not.toBeInTheDocument();
  });
});
