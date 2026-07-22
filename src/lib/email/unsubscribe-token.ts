import { createHmac, timingSafeEqual } from 'crypto';

function getUnsubscribeSecret(): string {
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET;
  if (!secret) {
    throw new Error('EMAIL_UNSUBSCRIBE_SECRET must be configured');
  }
  return secret;
}

export function buildUnsubscribeToken(userId: string): string {
  return createHmac('sha256', getUnsubscribeSecret())
    .update(userId)
    .digest('hex');
}

export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  const expected = buildUnsubscribeToken(userId);
  if (expected.length !== token.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}
