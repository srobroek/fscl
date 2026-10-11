/** Passwords are opaque: validate presence without trimming or normalizing. */
export function requirePassword(value: string | undefined): string {
  if (value === undefined || value.length === 0) {
    throw new Error('Missing required server password.');
  }
  return value;
}
