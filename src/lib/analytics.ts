import posthog from 'posthog-js';

export function track(event: string, properties?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  posthog.capture(event, properties);
}

export function identify(userId: string, traits?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  posthog.identify(userId, traits);
}
