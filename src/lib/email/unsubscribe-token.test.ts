import { afterEach, describe, expect, it } from 'vitest';
import {
  buildUnsubscribeToken,
  verifyUnsubscribeToken,
} from './unsubscribe-token';

const originalSecret = process.env.EMAIL_UNSUBSCRIBE_SECRET;

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.EMAIL_UNSUBSCRIBE_SECRET;
  } else {
    process.env.EMAIL_UNSUBSCRIBE_SECRET = originalSecret;
  }
});

describe('unsubscribe tokens', () => {
  it('fails closed when the signing secret is not configured', () => {
    delete process.env.EMAIL_UNSUBSCRIBE_SECRET;

    expect(() => buildUnsubscribeToken('user-id')).toThrow(
      'EMAIL_UNSUBSCRIBE_SECRET must be configured',
    );
  });

  it('accepts only tokens signed for the requested user', () => {
    process.env.EMAIL_UNSUBSCRIBE_SECRET = 'test-secret';
    const token = buildUnsubscribeToken('user-1');

    expect(verifyUnsubscribeToken('user-1', token)).toBe(true);
    expect(verifyUnsubscribeToken('user-2', token)).toBe(false);
    expect(verifyUnsubscribeToken('user-1', 'invalid')).toBe(false);
  });
});
