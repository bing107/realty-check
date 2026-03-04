/**
 * @jest-environment node
 */

const mockCapture = jest.fn();
const mockFlush = jest.fn().mockResolvedValue(undefined);

jest.mock('posthog-node', () => ({
  PostHog: jest.fn().mockImplementation(() => ({
    capture: mockCapture,
    flush: mockFlush,
  })),
}));

describe('posthog-server', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('no-ops when POSTHOG_API_KEY is not set', async () => {
    delete process.env.POSTHOG_API_KEY;

    const { serverTrack } = await import('@/lib/posthog-server');
    await serverTrack('user-1', 'test_event', { foo: 'bar' });

    expect(mockCapture).not.toHaveBeenCalled();
    expect(mockFlush).not.toHaveBeenCalled();
  });

  it('captures and flushes when POSTHOG_API_KEY is set', async () => {
    process.env.POSTHOG_API_KEY = 'phx_test_key';

    const { serverTrack } = await import('@/lib/posthog-server');
    await serverTrack('user-1', 'test_event', { foo: 'bar' });

    expect(mockCapture).toHaveBeenCalledWith({
      distinctId: 'user-1',
      event: 'test_event',
      properties: { foo: 'bar' },
    });
    expect(mockFlush).toHaveBeenCalled();
  });

  it('uses empty object for properties when none provided', async () => {
    process.env.POSTHOG_API_KEY = 'phx_test_key';

    const { serverTrack } = await import('@/lib/posthog-server');
    await serverTrack('user-1', 'test_event');

    expect(mockCapture).toHaveBeenCalledWith({
      distinctId: 'user-1',
      event: 'test_event',
      properties: {},
    });
  });
});
