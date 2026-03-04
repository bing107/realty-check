export interface ExtractResult {
  filename: string;
  pages: number;
  text: string;
  isScanned?: boolean;
  ocrApplied?: boolean;
  imageBatches?: string[][]; // batches of base64 data URLs for parallel OCR
}

const OCR_WIDTH = 1000;
const OCR_QUALITY = 0.6;
const BATCH_SIZE = 5;
const MAX_OCR_PAGES = 15;

export async function extractTextFromPdf(file: File): Promise<ExtractResult> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc =
    "https://unpkg.com/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;

  const textParts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    textParts.push(pageText);
  }

  const text = textParts.join("\n").trim();

  if (text) {
    return {
      filename: file.name,
      pages: pdf.numPages,
      text,
    };
  }

  // Scanned PDF: render pages to images for OCR
  const pageCount = Math.min(pdf.numPages, MAX_OCR_PAGES);
  const images: string[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const scale = OCR_WIDTH / viewport.width;
    const scaledViewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get 2D canvas context for page " + i);

    await page.render({ canvas, canvasContext: ctx, viewport: scaledViewport }).promise;
    images.push(canvas.toDataURL("image/jpeg", OCR_QUALITY));
  }

  // Split into batches for parallel processing
  const batches: string[][] = [];
  for (let i = 0; i < images.length; i += BATCH_SIZE) {
    batches.push(images.slice(i, i + BATCH_SIZE));
  }

  return {
    filename: file.name,
    pages: pdf.numPages,
    text: "OCR not supported: this appears to be a scanned PDF with no extractable text.",
    isScanned: true,
    imageBatches: batches,
  };
}
