import { describe, it, expect } from 'vitest';
import { overlaps, hasConflict } from '../../src/domain/availability.js';

// ---------------------------------------------------------------------------
// overlaps(aStart, aEnd, bStart, bEnd) - times are minutes after midnight
// ---------------------------------------------------------------------------
describe('overlaps', () => {
  it('overlaps_PartiallyOverlappingRanges_ReturnsTrue', () => {
    // Arrange
    const firstStart = 600; // 10:00
    const firstEnd = 630; // 10:30
    const secondStart = 615; // 10:15
    const secondEnd = 645; // 10:45

    // Act
    const result = overlaps(firstStart, firstEnd, secondStart, secondEnd);

    // Assert
    expect(result).toBe(true);
  });

  // Interpretation: back-to-back appointments (one ends exactly when the next starts) do not conflict.
  it('overlaps_BackToBackRanges_ReturnsFalse', () => {
    // Arrange
    const firstStart = 600; // 10:00
    const firstEnd = 630; // 10:30
    const secondStart = 630; // 10:30
    const secondEnd = 660; // 11:00

    // Act
    const result = overlaps(firstStart, firstEnd, secondStart, secondEnd);

    // Assert
    expect(result).toBe(false);
  });

  it('overlaps_OneMinuteOverlap_ReturnsTrue', () => {
    // Arrange
    const firstStart = 600; // 10:00
    const firstEnd = 631; // 10:31
    const secondStart = 630; // 10:30
    const secondEnd = 660; // 11:00

    // Act
    const result = overlaps(firstStart, firstEnd, secondStart, secondEnd);

    // Assert
    expect(result).toBe(true);
  });

  // Interpretation: a range that ends before it starts is not a real appointment, so it overlaps nothing.
  it('overlaps_ReversedRange_ReturnsFalse', () => {
    // Arrange
    const reversedStart = 650; // 10:50
    const reversedEnd = 600; // 10:00
    const otherStart = 610; // 10:10
    const otherEnd = 620; // 10:20

    // Act
    const result = overlaps(reversedStart, reversedEnd, otherStart, otherEnd);

    // Assert
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// hasConflict(booked, start, end) - "HH:MM" strings
// ---------------------------------------------------------------------------
describe('hasConflict', () => {
  it('hasConflict_SameSlotAlreadyBooked_ReturnsTrue', () => {
    // Arrange
    const booked = [{ start: '10:00', end: '10:30' }];

    // Act
    const result = hasConflict(booked, '10:00', '10:30');

    // Assert
    expect(result).toBe(true);
  });

  // Interpretation: back-to-back appointments do not conflict.
  it('hasConflict_BookingRightAfter_ReturnsFalse', () => {
    // Arrange
    const booked = [{ start: '10:30', end: '11:00' }];

    // Act
    const result = hasConflict(booked, '10:00', '10:30');

    // Assert
    expect(result).toBe(false);
  });

  it('hasConflict_NoBookings_ReturnsFalse', () => {
    // Arrange
    const booked = [];

    // Act
    const result = hasConflict(booked, '10:00', '10:30');

    // Assert
    expect(result).toBe(false);
  });
});
