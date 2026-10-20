import { describe, test } from 'node:test';
import { expect } from 'chai';
import { slotsForDay, findSlot, hasConflict } from '../../src/domain/availability.js';
import { makeProvider } from './support/fakes.js';

const MONDAY = '2026-10-19';
const TUESDAY = '2026-10-20';

const mondayHours = (start, end, slotMinutes = 30) => ({
  slotMinutes,
  weeklyHours: { 1: [{ start, end }] },
});

// ---------- Area: Availability ----------
describe('slotsForDay', () => {
  test('slotsForDay_ThirtyMinuteSlotsNineToEleven_ReturnsFourSlotsEndingAtEleven', () => {
    // Arrange
    const provider = mondayHours('09:00', '11:00', 30);

    // Act
    const slots = slotsForDay(provider, MONDAY);

    // Assert
    expect(slots).to.deep.equal([
      { start: '09:00', end: '09:30' },
      { start: '09:30', end: '10:00' },
      { start: '10:00', end: '10:30' },
      { start: '10:30', end: '11:00' },
    ]);
  });

  // Boundary: a 100-minute window with 45-minute slots fits two slots (90 min); a third would end after the
  // 10:40 closing time, so it must not be offered.
  test('slotsForDay_WindowNotDivisibleBySlotLength_DoesNotOfferSlotPastClosing', () => {
    // Arrange
    const provider = mondayHours('09:00', '10:40', 45);

    // Act
    const slots = slotsForDay(provider, MONDAY);

    // Assert
    expect(slots.map((s) => s.start)).to.deep.equal(['09:00', '09:45']);
  });

  test('slotsForDay_DayWithNoWorkingHours_ReturnsNoSlots', () => {
    // Arrange
    const provider = mondayHours('09:00', '17:00'); // Monday only

    // Act
    const slots = slotsForDay(provider, TUESDAY);

    // Assert
    expect(slots).to.be.empty;
  });
});

describe('findSlot', () => {
  const provider = makeProvider(); // 09:00-17:00, 30-minute slots

  test('findSlot_StartOnTheSlotGrid_ReturnsSlotEndingThirtyMinutesLater', () => {
    // Arrange
    const start = '09:30';

    // Act
    const slot = findSlot(provider, MONDAY, start);

    // Assert
    expect(slot).to.deep.equal({ start: '09:30', end: '10:00' });
  });

  test('findSlot_LastSlotEndingExactlyAtClosing_ReturnsThatSlot', () => {
    // Arrange
    const start = '16:30';

    // Act
    const slot = findSlot(provider, MONDAY, start);

    // Assert
    expect(slot).to.deep.equal({ start: '16:30', end: '17:00' });
  });

  test('findSlot_StartExactlyAtClosingTime_ReturnsUndefined', () => {
    // Arrange
    const start = '17:00';

    // Act
    const slot = findSlot(provider, MONDAY, start);

    // Assert
    expect(slot).to.be.undefined;
  });
});

// ---------- Area: Conflict detection ----------
describe('hasConflict', () => {
  const booked = [{ start: '10:00', end: '10:30' }];

  test('hasConflict_SameTimeAsExistingBooking_ReturnsTrue', () => {
    // Arrange
    const [newStart, newEnd] = ['10:00', '10:30'];

    // Act
    const result = hasConflict(booked, newStart, newEnd);

    // Assert
    expect(result).to.be.true;
  });

  test('hasConflict_NewBlockStartsWhenExistingEnds_ReturnsFalse', () => {
    // Arrange
    const [newStart, newEnd] = ['10:30', '11:00'];

    // Act
    const result = hasConflict(booked, newStart, newEnd);

    // Assert
    expect(result).to.be.false;
  });

  test('hasConflict_NewBlockOverlapsEndByOneMinute_ReturnsTrue', () => {
    // Arrange
    const [newStart, newEnd] = ['10:29', '10:59'];

    // Act
    const result = hasConflict(booked, newStart, newEnd);

    // Assert
    expect(result).to.be.true;
  });
});