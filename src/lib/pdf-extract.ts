export interface ExtractResult {
  filename: string;
  pages: number;
  text: string;
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

  return {
    filename: file.name,
    pages: pdf.numPages,
    text:
      text ||
      "OCR not supported: this appears to be a scanned PDF with no extractable text.",
  };
}
