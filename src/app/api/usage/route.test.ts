/**
 * @jest-environment node
 */

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/auth-config', () => ({
  isAuthEnabled: true,
}));

jest.mock('@/lib/usage', () => ({
  getUserUsage: jest.fn(),
}));

import { GET } from './route';
import { auth } from '@/auth';
import { getUserUsage } from '@/lib/usage';

const mockAuth = auth as jest.Mock;
const mockGetUserUsage = getUserUsage as jest.Mock;

describe('GET /api/usage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when there is no session', async () => {
    mockAuth.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 when session has no user id', async () => {
    mockAuth.mockResolvedValue({ user: {} });

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns usage data when authenticated', async () => {
    const periodStart = new Date('2026-03-01T00:00:00Z');

    mockAuth.mockResolvedValue({
      user: { id: 'user-123' },
    });
    mockGetUserUsage.mockResolvedValue({
      tier: 'pro',
      used: 5,
      limit: 30,
      periodStart,
    });

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.tier).toBe('pro');
    expect(body.used).toBe(5);
    expect(body.limit).toBe(30);
    expect(body.periodStart).toBe(periodStart.toISOString());
  });

  it('returns null limit for mentoring tier (Infinity)', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-123' },
    });
    mockGetUserUsage.mockResolvedValue({
      tier: 'mentoring',
      used: 50,
      limit: Infinity,
      periodStart: new Date('2026-03-01T00:00:00Z'),
    });

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.tier).toBe('mentoring');
    expect(body.limit).toBeNull();
  });
});
