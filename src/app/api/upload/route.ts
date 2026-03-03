import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const MAX_SIZE = 20 * 1024 * 1024; // 20MB
const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file)
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.type !== "application/pdf")
    return NextResponse.json(
      { error: "Only PDF files are accepted" },
      { status: 400 }
    );
  if (file.size > MAX_SIZE)
    return NextResponse.json(
      { error: "File exceeds 20MB limit" },
      { status: 400 }
    );

  await mkdir(UPLOAD_DIR, { recursive: true });

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  await writeFile(path.join(UPLOAD_DIR, safeName), buffer);

  return NextResponse.json({ name: file.name, size: file.size, saved: safeName });
}
