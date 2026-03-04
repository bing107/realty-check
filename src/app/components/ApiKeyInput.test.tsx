import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import ApiKeyInput from "./ApiKeyInput";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock, configurable: true });

describe("ApiKeyInput", () => {
  const onChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
  });

  it("renders an input of type password by default", () => {
    render(<ApiKeyInput value="" onChange={onChange} />);
    const input = screen.getByPlaceholderText("sk-ant-...");
    expect(input).toHaveAttribute("type", "password");
  });

  it("Show button toggles input to type text", () => {
    render(<ApiKeyInput value="" onChange={onChange} />);
    const input = screen.getByPlaceholderText("sk-ant-...");
    const showButton = screen.getByRole("button", { name: "Show" });

    fireEvent.click(showButton);

    expect(input).toHaveAttribute("type", "text");
  });

  it("Hide button toggles input back to password", () => {
    render(<ApiKeyInput value="" onChange={onChange} />);
    const input = screen.getByPlaceholderText("sk-ant-...");
    const showButton = screen.getByRole("button", { name: "Show" });

    // First click: show
    fireEvent.click(showButton);
    expect(input).toHaveAttribute("type", "text");

    // Button text should now be "Hide"
    const hideButton = screen.getByRole("button", { name: "Hide" });
    fireEvent.click(hideButton);

    expect(input).toHaveAttribute("type", "password");
  });

  it("onChange callback is called with new value", () => {
    render(<ApiKeyInput value="" onChange={onChange} />);
    const input = screen.getByPlaceholderText("sk-ant-...");

    fireEvent.change(input, { target: { value: "sk-ant-test-key" } });

    expect(onChange).toHaveBeenCalledWith("sk-ant-test-key");
  });

  it("reads from localStorage on mount", () => {
    localStorageMock.getItem.mockReturnValueOnce("sk-ant-stored-key");

    render(<ApiKeyInput value="" onChange={onChange} />);

    expect(localStorageMock.getItem).toHaveBeenCalledWith("anthropic_api_key");
    expect(onChange).toHaveBeenCalledWith("sk-ant-stored-key");
  });

  it("does not call onChange from localStorage when value is already set", () => {
    localStorageMock.getItem.mockReturnValueOnce("sk-ant-stored-key");

    render(<ApiKeyInput value="sk-ant-existing" onChange={onChange} />);

    expect(localStorageMock.getItem).toHaveBeenCalledWith("anthropic_api_key");
    // onChange should NOT be called because value is already populated
    expect(onChange).not.toHaveBeenCalled();
  });

  it("writes to localStorage on change", () => {
    render(<ApiKeyInput value="" onChange={onChange} />);
    const input = screen.getByPlaceholderText("sk-ant-...");

    fireEvent.change(input, { target: { value: "sk-ant-new-key" } });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "anthropic_api_key",
      "sk-ant-new-key"
    );
  });

  it("removes from localStorage when key is cleared (line 26)", () => {
    render(<ApiKeyInput value="sk-ant-existing" onChange={onChange} />);
    const input = screen.getByPlaceholderText("sk-ant-...");

    fireEvent.change(input, { target: { value: "" } });

    expect(localStorageMock.removeItem).toHaveBeenCalledWith("anthropic_api_key");
    expect(onChange).toHaveBeenCalledWith("");
  });
});
