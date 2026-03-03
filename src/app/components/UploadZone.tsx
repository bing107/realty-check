"use client";

import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";

interface UploadFile {
  id: string;
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
  saved?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function uploadFile(
  uploadFile: UploadFile,
  onProgress: (progress: number) => void,
  onDone: (saved: string) => void,
  onError: (message: string) => void
) {
  const xhr = new XMLHttpRequest();
  const formData = new FormData();
  formData.append("file", uploadFile.file);

  xhr.upload.addEventListener("progress", (e) => {
    if (e.lengthComputable) {
      const percent = Math.round((e.loaded / e.total) * 100);
      onProgress(percent);
    }
  });

  xhr.addEventListener("load", () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      try {
        const resp = JSON.parse(xhr.responseText);
        onDone(resp.saved);
      } catch {
        onDone("");
      }
    } else {
      let message = "Upload failed";
      try {
        const resp = JSON.parse(xhr.responseText);
        if (resp.error) message = resp.error;
      } catch {
        // use default message
      }
      onError(message);
    }
  });

  xhr.addEventListener("error", () => {
    onError("Network error");
  });

  xhr.open("POST", "/api/upload");
  xhr.send(formData);
}

interface UploadZoneProps {
  onUploadedChange: (savedFiles: string[]) => void;
}

export default function UploadZone({ onUploadedChange }: UploadZoneProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);

  useEffect(() => {
    const savedFiles = files
      .filter((f) => f.status === "done" && f.saved)
      .map((f) => f.saved!);
    onUploadedChange(savedFiles);
  }, [files, onUploadedChange]);

  const updateFile = useCallback(
    (id: string, updates: Partial<UploadFile>) => {
      setFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
      );
    },
    []
  );

  const startUpload = useCallback(
    (entry: UploadFile) => {
      updateFile(entry.id, { status: "uploading", progress: 0 });
      uploadFile(
        entry,
        (progress) => updateFile(entry.id, { progress }),
        (saved) => updateFile(entry.id, { status: "done", progress: 100, saved }),
        (error) => updateFile(entry.id, { status: "error", error })
      );
    },
    [updateFile]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newEntries: UploadFile[] = acceptedFiles.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        file,
        status: "pending" as const,
        progress: 0,
      }));

      setFiles((prev) => [...prev, ...newEntries]);

      newEntries.forEach((entry) => {
        startUpload(entry);
      });
    },
    [startUpload]
  );

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxSize: 20 * 1024 * 1024,
    multiple: true,
  });

  return (
    <div>
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl py-16 px-8 text-center cursor-pointer transition-colors ${
          isDragActive
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <input {...getInputProps()} />
        <svg
          className="mx-auto h-12 w-12 text-gray-400 mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
          />
        </svg>
        {isDragActive ? (
          <p className="text-blue-600 font-medium">Drop your PDF files here</p>
        ) : (
          <>
            <p className="text-gray-600 font-medium">
              Drag & drop PDF files here, or click to browse
            </p>
            <p className="text-gray-400 text-sm mt-1">
              PDF only, up to 20 MB per file
            </p>
          </>
        )}
      </div>

      {files.length > 0 && (
        <div className="mt-6 space-y-2">
          {files.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <svg
                  className="h-5 w-5 text-red-500 shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">
                    {f.file.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatFileSize(f.file.size)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 ml-4">
                {f.status === "pending" && (
                  <span className="text-xs font-medium text-gray-500 bg-gray-200 px-2 py-1 rounded-full">
                    Pending
                  </span>
                )}
                {f.status === "uploading" && (
                  <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                    {f.progress}%
                  </span>
                )}
                {f.status === "done" && (
                  <>
                    <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-1 rounded-full flex items-center gap-1">
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Done
                    </span>
                    <button
                      onClick={() => removeFile(f.id)}
                      className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                      aria-label="Remove file"
                    >
                      &times;
                    </button>
                  </>
                )}
                {f.status === "error" && (
                  <>
                    <span
                      className="text-xs font-medium text-red-600 bg-red-100 px-2 py-1 rounded-full max-w-[150px] truncate"
                      title={f.error}
                    >
                      {f.error}
                    </span>
                    <button
                      onClick={() => removeFile(f.id)}
                      className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                      aria-label="Remove file"
                    >
                      &times;
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
