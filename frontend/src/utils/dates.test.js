import { describe, expect, it } from 'vitest';
import { isoDay } from './dates';

describe('isoDay', () => {
  it('keeps the day of an ISO date-time', () => {
    expect(isoDay('2026-11-01T11:18:01.579123')).toBe('2026-11-01');
    expect(isoDay('2026-06-09T00:00')).toBe('2026-06-09');
  });

  it('leaves an ISO date as it is', () => {
    expect(isoDay('2026-11-01')).toBe('2026-11-01');
  });

  it('is empty without a value', () => {
    expect(isoDay(null)).toBe('');
    expect(isoDay(undefined)).toBe('');
    expect(isoDay('')).toBe('');
  });
});
