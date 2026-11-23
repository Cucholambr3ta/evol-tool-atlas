import { describe, expect, it } from 'vitest';
import { formatBytes } from '../../src/lib/offline';

describe('offline utilities', () => {
  it('formats byte counts cleanly', () => {
    expect(formatBytes(null)).toBe('No disponible');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});
