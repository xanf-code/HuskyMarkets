import { createHmac } from 'crypto';
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const { createAdminClient } = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient,
}));

const originalSecret = process.env.EMAIL_UNSUBSCRIBE_SECRET;

afterEach(() => {
  vi.clearAllMocks();
  if (originalSecret === undefined) {
    delete process.env.EMAIL_UNSUBSCRIBE_SECRET;
  } else {
    process.env.EMAIL_UNSUBSCRIBE_SECRET = originalSecret;
  }
});

describe('unsubscribe route', () => {
  it('rejects tokens signed with the former fallback secret', async () => {
    delete process.env.EMAIL_UNSUBSCRIBE_SECRET;
    const uid = 'public-user-id';
    const forgedToken = createHmac('sha256', 'dev-secret')
      .update(uid)
      .digest('hex');
    const req = new NextRequest(
      `http://localhost/api/email/unsubscribe?uid=${uid}&token=${forgedToken}`,
    );

    const response = await GET(req);

    expect(response.status).toBe(400);
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});
