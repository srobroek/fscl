import { describe, expect, it } from 'vitest';
import { requirePassword } from './password.js';

describe('opaque server passwords', () => {
  it.each([' boundary spaces ', '   ', 'Ab!@#$%^&*()_+{}|:"<>?`~[]\\;', 'Caf\u00e9\u{1f511}e\u0301'])('preserves synthetic input %j', value => {
    expect(requirePassword(value)).toBe(value);
  });
  it.each([undefined, ''])('rejects absent input', value => {
    expect(() => requirePassword(value)).toThrow('Missing required server password');
  });
});
