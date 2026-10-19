import { describe, it, expect } from 'vitest';
import { overlaps, hasConflict, slotsForDay, findSlot } from '../../src/domain/availability.js';

// Test data shared by the slot tests. Each test builds its own copy, so no test can affect another.
const MONDAY = '2026-10-19';
const SUNDAY = '2026-10-18';

// A provider open Mondays 09:00-17:00 with slots of the given length (30 minutes unless stated).
const mondayProvider = (slotMinutes = 30) => ({
  slotMinutes,
  weeklyHours: { 1: [{ start: '09:00', end: '17:00' }] },
});

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

// ---------------------------------------------------------------------------
// slotsForDay(provider, date)
// ---------------------------------------------------------------------------
describe('slotsForDay', () => {
  it('slotsForDay_OpenWeekday_ReturnsSixteenSlots', () => {
    // Arrange
    const provider = mondayProvider();

    // Act
    const slots = slotsForDay(provider, MONDAY);

    // Assert
    expect(slots).toHaveLength(16);
  });

  // Block durations: a block that would run past closing time (17:00) must not be offered.
  it('slotsForDay_FortyFiveMinuteSlots_LastSlotEndsBeforeClosing', () => {
    // Arrange
    const provider = mondayProvider(45);

    // Act
    const slots = slotsForDay(provider, MONDAY);

    // Assert
    expect(slots.at(-1)).toEqual({ start: '15:45', end: '16:30' });
  });

  it('slotsForDay_ClosedDay_ReturnsNoSlots', () => {
    // Arrange
    const provider = mondayProvider();

    // Act
    const slots = slotsForDay(provider, SUNDAY);

    // Assert
    expect(slots).toEqual([]);
  });

  // Interpretation: a date that does not exist (February 30) has no slots.
  it('slotsForDay_NonExistentDate_ReturnsNoSlots', () => {
    // Arrange
    const provider = mondayProvider();

    // Act
    const slots = slotsForDay(provider, '2026-02-30');

    // Assert
    expect(slots).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// findSlot(provider, date, start)
// ---------------------------------------------------------------------------
describe('findSlot', () => {
  it('findSlot_TimeOnGrid_ReturnsSlot', () => {
    // Arrange
    const provider = mondayProvider();

    // Act
    const slot = findSlot(provider, MONDAY, '10:00');

    // Assert
    expect(slot).toEqual({ start: '10:00', end: '10:30' });
  });

  it('findSlot_LastSlotOfDay_ReturnsSlot', () => {
    // Arrange
    const provider = mondayProvider();

    // Act
    const slot = findSlot(provider, MONDAY, '16:30');

    // Assert
    expect(slot).toEqual({ start: '16:30', end: '17:00' });
  });

  // Interpretation: 17:00 is closing time, so a slot starting then would end after closing.
  it('findSlot_ClosingTime_ReturnsUndefined', () => {
    // Arrange
    const provider = mondayProvider();

    // Act
    const slot = findSlot(provider, MONDAY, '17:00');

    // Assert
    expect(slot).toBeUndefined();
  });

  it('findSlot_TimeOffGrid_ReturnsUndefined', () => {
    // Arrange
    const provider = mondayProvider();

    // Act
    const slot = findSlot(provider, MONDAY, '10:15');

    // Assert
    expect(slot).toBeUndefined();
  });
});
