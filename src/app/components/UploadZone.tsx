"use client";

import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";

interface UploadFile {
  id: string;
  file: File;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MAX_SIZE = 20 * 1024 * 1024; // 20MB

interface UploadZoneProps {
  onFilesChange: (files: File[]) => void;
}

export default function UploadZone({ onFilesChange }: UploadZoneProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);

  useEffect(() => {
    onFilesChange(files.map((f) => f.file));
  }, [files, onFilesChange]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newEntries: UploadFile[] = acceptedFiles
      .filter((f) => f.size <= MAX_SIZE)
      .map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        file,
      }));
    setFiles((prev) => [...prev, ...newEntries]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxSize: MAX_SIZE,
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

              <button
                onClick={() => removeFile(f.id)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none shrink-0 ml-4"
                aria-label="Remove file"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
