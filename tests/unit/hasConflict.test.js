import { describe, expect, it } from 'vitest';
import { hasConflict } from '../../src/domain/availability.js';

// Conflict detection: appointments are half-open intervals [start, end), so
// back-to-back appointments do not conflict (end of one == start of the next).
describe('hasConflict', () => {
  it('hasConflict_NoBookings_ReturnsFalse', () => {
    const booked = [];

    const result = hasConflict(booked, '10:00', '10:30');

    expect(result).toBe(false);
  });
});
