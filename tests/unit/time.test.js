import { describe, expect, it } from 'vitest';
import { isDate, isTime } from '../../src/domain/time.js';

describe('isDate', () => {
  it('isDate_ValidDate_ReturnsTrue', () => {
    const result = isDate('2030-01-07');

    expect(result).toBe(true);
  });

  it('isDate_FebruaryTwentyNinthInLeapYear_ReturnsTrue', () => {
    const result = isDate('2028-02-29');

    expect(result).toBe(true);
  });

  it('isDate_FebruaryTwentyNinthInNonLeapYear_ReturnsFalse', () => {
    const result = isDate('2030-02-29');

    expect(result).toBe(false);
  });

  it('isDate_MonthThirteen_ReturnsFalse', () => {
    const result = isDate('2030-13-01');

    expect(result).toBe(false);
  });

  it('isDate_WrongFormat_ReturnsFalse', () => {
    const result = isDate('01/07/2030');

    expect(result).toBe(false);
  });

  it('isDate_NotAString_ReturnsFalse', () => {
    const result = isDate(20300107);

    expect(result).toBe(false);
  });
});

describe('isTime', () => {
  it('isTime_LastMinuteOfDay_ReturnsTrue', () => {
    const result = isTime('23:59');

    expect(result).toBe(true);
  });

  it('isTime_Midnight2400_ReturnsFalse', () => {
    const result = isTime('24:00');

    expect(result).toBe(false);
  });

  it('isTime_SixtyMinutes_ReturnsFalse', () => {
    const result = isTime('10:60');

    expect(result).toBe(false);
  });

  it('isTime_SingleDigitHour_ReturnsFalse', () => {
    const result = isTime('9:00');

    expect(result).toBe(false);
  });
});
