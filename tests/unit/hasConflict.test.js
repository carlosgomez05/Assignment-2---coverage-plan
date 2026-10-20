import { describe, expect, it } from 'vitest';
import { hasConflict } from '../../src/domain/availability.js';

// Conflict detection. Interpretation (not spelled out in the requirements): an appointment
// occupies the half-open interval [start, end), so back-to-back appointments do not conflict.
describe('hasConflict', () => {
  const booked = [{ start: '10:00', end: '10:30' }];

  it('hasConflict_NoBookings_ReturnsFalse', () => {
    const none = [];

    const result = hasConflict(none, '10:00', '10:30');

    expect(result).toBe(false);
  });

  it('hasConflict_IdenticalTime_ReturnsTrue', () => {
    const result = hasConflict(booked, '10:00', '10:30');

    expect(result).toBe(true);
  });

  it('hasConflict_StartsOneMinuteBeforeBookedEnd_ReturnsTrue', () => {
    const result = hasConflict(booked, '10:29', '10:59');

    expect(result).toBe(true);
  });

  it('hasConflict_StartsExactlyWhenBookedEnds_ReturnsFalse', () => {
    const result = hasConflict(booked, '10:30', '11:00');

    expect(result).toBe(false);
  });

  it('hasConflict_EndsOneMinuteAfterBookedStart_ReturnsTrue', () => {
    const result = hasConflict(booked, '09:31', '10:01');

    expect(result).toBe(true);
  });

  it('hasConflict_EndsExactlyWhenBookedStarts_ReturnsFalse', () => {
    const result = hasConflict(booked, '09:30', '10:00');

    expect(result).toBe(false);
  });

  it('hasConflict_NewAppointmentFullyContainsBooked_ReturnsTrue', () => {
    const result = hasConflict(booked, '09:00', '12:00');

    expect(result).toBe(true);
  });

  it('hasConflict_OnlyLaterOfTwoBookingsOverlaps_ReturnsTrue', () => {
    const two = [{ start: '09:00', end: '09:30' }, { start: '14:00', end: '15:00' }];

    const result = hasConflict(two, '14:30', '15:00');

    expect(result).toBe(true);
  });
});
