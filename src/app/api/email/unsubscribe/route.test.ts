import { createHmac } from 'crypto';
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './route';

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
  it('requires confirmation without mutating preferences on GET', async () => {
    process.env.EMAIL_UNSUBSCRIBE_SECRET = 'test-secret';
    const uid = 'public-user-id';
    const token = createHmac('sha256', process.env.EMAIL_UNSUBSCRIBE_SECRET)
      .update(uid)
      .digest('hex');
    const req = new NextRequest(
      `http://localhost/api/email/unsubscribe?uid=${uid}&token=${token}`,
    );

    const response = await GET(req);

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<form method="post">');
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it('unsubscribes a recipient on a signed POST request', async () => {
    process.env.EMAIL_UNSUBSCRIBE_SECRET = 'test-secret';
    const uid = 'public-user-id';
    const token = createHmac('sha256', process.env.EMAIL_UNSUBSCRIBE_SECRET)
      .update(uid)
      .digest('hex');
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ update }));
    createAdminClient.mockReturnValue({ from });
    const req = new NextRequest(
      `http://localhost/api/email/unsubscribe?uid=${uid}&token=${token}`,
      { method: 'POST' },
    );

    const response = await POST(req);

    expect(response.status).toBe(200);
    expect(from).toHaveBeenCalledWith('profiles');
    expect(update).toHaveBeenCalledWith({ email_notifications: false });
    expect(eq).toHaveBeenCalledWith('id', uid);
  });

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
