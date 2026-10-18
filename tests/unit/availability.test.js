import { describe, it, expect } from 'vitest';
import { overlaps } from '../../src/domain/availability.js';

// ---------------------------------------------------------------------------
// overlaps(aStart, aEnd, bStart, bEnd) - times are minutes after midnight
// ---------------------------------------------------------------------------
describe('overlaps', () => {
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
});
