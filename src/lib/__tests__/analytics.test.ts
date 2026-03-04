const mockCapture = jest.fn();
const mockIdentify = jest.fn();

jest.mock("posthog-js", () => ({
  __esModule: true,
  default: {
    capture: (...args: unknown[]) => mockCapture(...args),
    identify: (...args: unknown[]) => mockIdentify(...args),
  },
}));

import { track, identify } from "@/lib/analytics";

describe("analytics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("track", () => {
    it("calls posthog.capture when window is defined", () => {
      track("test_event", { key: "value" });
      expect(mockCapture).toHaveBeenCalledWith("test_event", { key: "value" });
    });

    it("calls posthog.capture without properties", () => {
      track("simple_event");
      expect(mockCapture).toHaveBeenCalledWith("simple_event", undefined);
    });
  });

  describe("identify", () => {
    it("calls posthog.identify when window is defined", () => {
      identify("user-123", { name: "Test" });
      expect(mockIdentify).toHaveBeenCalledWith("user-123", { name: "Test" });
    });

    it("calls posthog.identify without traits", () => {
      identify("user-456");
      expect(mockIdentify).toHaveBeenCalledWith("user-456", undefined);
    });
  });
});
