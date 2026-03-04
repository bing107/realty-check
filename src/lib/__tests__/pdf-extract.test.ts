/**
 * @jest-environment jsdom
 */

// --- Mock pdfjs-dist before importing the module under test ---

const mockGetTextContent = jest.fn();
const mockGetViewport = jest.fn();
const mockRender = jest.fn();
const mockGetPage = jest.fn();

const mockPdf = {
  numPages: 3,
  getPage: mockGetPage,
};

const mockGetDocument = jest.fn().mockReturnValue({
  promise: Promise.resolve(mockPdf),
});

jest.mock('pdfjs-dist', () => ({
  getDocument: (...args: unknown[]) => mockGetDocument(...args),
  GlobalWorkerOptions: { workerSrc: '' },
}));

// --- Mock canvas / toDataURL ---

const mockToDataURL = jest.fn().mockReturnValue('data:image/jpeg;base64,fakeImageData');
const mockGetContext = jest.fn().mockReturnValue({
  // Minimal CanvasRenderingContext2D mock — render() only needs it passed in
});

beforeEach(() => {
  // Override document.createElement to return a mock canvas for 'canvas' elements
  const originalCreateElement = document.createElement.bind(document);
  jest.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: ElementCreationOptions) => {
    if (tagName === 'canvas') {
      const fakeCanvas = {
        width: 0,
        height: 0,
        getContext: mockGetContext,
        toDataURL: mockToDataURL,
      };
      return fakeCanvas as unknown as HTMLCanvasElement;
    }
    return originalCreateElement(tagName, options);
  });
});

import { extractTextFromPdf } from '../pdf-extract';

// Helper: create a File object with a working arrayBuffer method
function makeFile(name: string): File {
  const blob = new Blob(['dummy pdf content'], { type: 'application/pdf' });
  const file = new File([blob], name, { type: 'application/pdf' });
  // jsdom File may not implement arrayBuffer(); polyfill it
  if (typeof file.arrayBuffer !== 'function') {
    file.arrayBuffer = () =>
      new Promise<ArrayBuffer>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.readAsArrayBuffer(blob);
      });
  }
  return file;
}

// Helper: set up pdfjs mocks for text extraction scenario
function setupTextExtraction(pages: string[]) {
  mockPdf.numPages = pages.length;
  mockGetDocument.mockReturnValue({
    promise: Promise.resolve(mockPdf),
  });

  mockGetPage.mockImplementation((pageNum: number) => {
    const items = pages[pageNum - 1]
      ? [{ str: pages[pageNum - 1] }]
      : [];
    return Promise.resolve({
      getTextContent: jest.fn().mockResolvedValue({ items }),
      getViewport: mockGetViewport.mockReturnValue({ width: 1000, height: 1400 }),
      render: mockRender.mockReturnValue({ promise: Promise.resolve() }),
    });
  });
}

// Helper: set up for scanned PDF (no text extracted)
function setupScannedPdf(numPages: number) {
  mockPdf.numPages = numPages;
  mockGetDocument.mockReturnValue({
    promise: Promise.resolve(mockPdf),
  });

  mockGetPage.mockImplementation(() => {
    return Promise.resolve({
      getTextContent: jest.fn().mockResolvedValue({ items: [] }),
      getViewport: mockGetViewport.mockReturnValue({ width: 1000, height: 1400 }),
      render: mockRender.mockReturnValue({ promise: Promise.resolve() }),
    });
  });
}

// Helper: count total images across all batches
function totalImages(batches: string[][] | undefined): number {
  if (!batches) return 0;
  return batches.reduce((sum, b) => sum + b.length, 0);
}

describe('extractTextFromPdf', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-setup defaults
    mockToDataURL.mockReturnValue('data:image/jpeg;base64,fakeImageData');
    mockGetContext.mockReturnValue({});
  });

  // --- Text extraction (existing behavior) ---

  it('returns text when pdfjs extracts text successfully', async () => {
    setupTextExtraction(['Page one text', 'Page two text', 'Page three text']);

    const result = await extractTextFromPdf(makeFile('test.pdf'));

    expect(result.filename).toBe('test.pdf');
    expect(result.pages).toBe(3);
    expect(result.text).toContain('Page one text');
    expect(result.text).toContain('Page two text');
    expect(result.text).toContain('Page three text');
    expect(result.isScanned).toBeUndefined();
    expect(result.imageBatches).toBeUndefined();
  });

  it('joins text from multiple pages with newlines', async () => {
    setupTextExtraction(['First page', 'Second page']);

    const result = await extractTextFromPdf(makeFile('multi.pdf'));

    // Text parts are joined with \n and trimmed
    expect(result.text).toBe('First page\nSecond page');
  });

  it('handles single-page PDF with text', async () => {
    setupTextExtraction(['Only page']);

    const result = await extractTextFromPdf(makeFile('single.pdf'));

    expect(result.pages).toBe(1);
    expect(result.text).toBe('Only page');
    expect(result.isScanned).toBeUndefined();
  });

  // --- Scanned PDF behavior ---

  it('sets isScanned to true when no text is extracted', async () => {
    setupScannedPdf(3);

    const result = await extractTextFromPdf(makeFile('scanned.pdf'));

    expect(result.isScanned).toBe(true);
    expect(result.text).toContain('OCR not supported');
  });

  it('populates imageBatches when no text is extracted', async () => {
    setupScannedPdf(3);

    const result = await extractTextFromPdf(makeFile('scanned.pdf'));

    expect(result.imageBatches).toBeDefined();
    expect(totalImages(result.imageBatches)).toBe(3);
    expect(result.imageBatches![0][0]).toBe('data:image/jpeg;base64,fakeImageData');
  });

  it('caps images at 15 pages for large scanned PDFs', async () => {
    setupScannedPdf(20);

    const result = await extractTextFromPdf(makeFile('large-scan.pdf'));

    expect(result.pages).toBe(20); // Total pages is still 20
    expect(totalImages(result.imageBatches)).toBe(15); // But only 15 images rendered
    expect(result.isScanned).toBe(true);
  });

  it('renders all pages when scanned PDF has fewer than 15 pages', async () => {
    setupScannedPdf(5);

    const result = await extractTextFromPdf(makeFile('small-scan.pdf'));

    expect(totalImages(result.imageBatches)).toBe(5);
  });

  it('renders exactly 15 pages when scanned PDF has exactly 15 pages', async () => {
    setupScannedPdf(15);

    const result = await extractTextFromPdf(makeFile('fifteen.pdf'));

    expect(totalImages(result.imageBatches)).toBe(15);
  });

  it('batches images into groups of 5', async () => {
    setupScannedPdf(12);

    const result = await extractTextFromPdf(makeFile('batched.pdf'));

    expect(result.imageBatches).toHaveLength(3); // 5 + 5 + 2
    expect(result.imageBatches![0]).toHaveLength(5);
    expect(result.imageBatches![1]).toHaveLength(5);
    expect(result.imageBatches![2]).toHaveLength(2);
  });

  it('calls page.render with canvas context and viewport', async () => {
    setupScannedPdf(1);

    await extractTextFromPdf(makeFile('one-page-scan.pdf'));

    expect(mockRender).toHaveBeenCalledTimes(1);
    const renderArgs = mockRender.mock.calls[0][0];
    expect(renderArgs).toHaveProperty('canvasContext');
    expect(renderArgs).toHaveProperty('viewport');
  });

  it('scales viewport so width is 1000px', async () => {
    setupScannedPdf(1);

    await extractTextFromPdf(makeFile('scaled.pdf'));

    // getViewport is called first with scale=1 (returns width=1000),
    // then with scale=1000/1000=1
    expect(mockGetViewport).toHaveBeenCalledWith({ scale: 1 });
    expect(mockGetViewport).toHaveBeenCalledWith({ scale: 1 });
  });

  it('calls toDataURL with JPEG format and 0.6 quality', async () => {
    setupScannedPdf(1);

    await extractTextFromPdf(makeFile('quality.pdf'));

    expect(mockToDataURL).toHaveBeenCalledWith('image/jpeg', 0.6);
  });

  it('returns text with only whitespace as scanned (after trim)', async () => {
    // Pages that produce only spaces/whitespace
    mockPdf.numPages = 2;
    mockGetDocument.mockReturnValue({
      promise: Promise.resolve(mockPdf),
    });
    mockGetPage.mockImplementation(() => {
      return Promise.resolve({
        getTextContent: jest.fn().mockResolvedValue({ items: [{ str: '   ' }] }),
        getViewport: mockGetViewport.mockReturnValue({ width: 1000, height: 1400 }),
        render: mockRender.mockReturnValue({ promise: Promise.resolve() }),
      });
    });

    const result = await extractTextFromPdf(makeFile('whitespace.pdf'));

    // "   \n   ".trim() === "" which is falsy, so it should be treated as scanned
    expect(result.isScanned).toBe(true);
    expect(totalImages(result.imageBatches)).toBe(2);
  });
});
