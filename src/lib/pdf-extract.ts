export interface ExtractResult {
  filename: string;
  pages: number;
  text: string;
  isScanned?: boolean;
  images?: string[]; // base64 data URLs of rendered page images
}

export async function extractTextFromPdf(file: File): Promise<ExtractResult> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc =
    "https://unpkg.com/pdfjs-dist@5.5.207/build/pdf.worker.min.mjs";

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
  const maxPages = Math.min(pdf.numPages, 15);
  const images: string[] = [];

  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const scale = 1500 / viewport.width;
    const scaledViewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;
    const ctx = canvas.getContext("2d")!;

    await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
    images.push(canvas.toDataURL("image/jpeg", 0.85));
  }

  return {
    filename: file.name,
    pages: pdf.numPages,
    text: "OCR not supported: this appears to be a scanned PDF with no extractable text.",
    isScanned: true,
    images,
  };
}
