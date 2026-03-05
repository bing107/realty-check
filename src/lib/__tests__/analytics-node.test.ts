/**
 * @jest-environment node
 */
// Test that track/identify are no-ops when window is undefined (SSR context)
// In node environment, window is undefined so the guard should prevent posthog calls

const mockCapture = jest.fn();
const mockIdentify = jest.fn();

jest.mock('posthog-js', () => ({
  __esModule: true,
  default: {
    capture: (...args: unknown[]) => mockCapture(...args),
    identify: (...args: unknown[]) => mockIdentify(...args),
  },
}));

import { track, identify } from '@/lib/analytics';

describe('analytics (node/SSR environment)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('track() does NOT call posthog.capture when window is undefined', () => {
    track('test_event', { key: 'value' });
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it('identify() does NOT call posthog.identify when window is undefined', () => {
    identify('user-123', { name: 'Test' });
    expect(mockIdentify).not.toHaveBeenCalled();
  });
});
