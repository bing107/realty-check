"use client";

import { useState, useEffect, useRef } from "react";

interface Props {
  value: string;
  onChange: (key: string) => void;
}

export default function ApiKeyInput({ value, onChange }: Props) {
  const [show, setShow] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const stored = localStorage.getItem("anthropic_api_key");
    if (stored && !value) onChange(stored);
  }, [value, onChange]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const key = e.target.value;
    if (key) {
      localStorage.setItem("anthropic_api_key", key);
    } else {
      localStorage.removeItem("anthropic_api_key");
    }
    onChange(key);
  }

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Anthropic API Key
      </label>
      <div className="flex gap-2">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={handleChange}
          placeholder="sk-ant-..."
          className="flex-1 rounded-xl border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50"
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        Enter your Anthropic API key. Get one at{" "}
        <a
          href="https://console.anthropic.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline"
        >
          console.anthropic.com
        </a>
      </p>
    </div>
  );
}
