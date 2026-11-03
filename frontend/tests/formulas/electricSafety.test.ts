import { describe, expect, it } from 'vitest';
import { safeDistance, stepVoltage } from '../../src/formulas/electricSafety';

describe('safeDistance', () => {
  it.each([
    [10_000, 1_000, 40, 0.8],
    [50, 500, 40, 0.8],
    [1, 1, 40, 0.8],
    [100, 100, 10, 1.2],
  ])('returns a distance below the voltage threshold (%s A)', (current, resistivity, threshold, step) => {
    const distance = safeDistance(current, resistivity, threshold, step);
    expect(Number.isFinite(distance)).toBe(true);
    expect(distance).toBeGreaterThanOrEqual(0.5);
    expect(stepVoltage(current, resistivity, distance, step)).toBeLessThan(threshold);
    if (distance > 0.5) {
      expect(stepVoltage(current, resistivity, distance - 0.5, step)).toBeGreaterThanOrEqual(threshold);
    }
  });

  it('moves beyond an exact threshold boundary', () => {
    const threshold = stepVoltage(50, 500, 10);
    expect(safeDistance(50, 500, threshold)).toBe(10.5);
  });

  it.each([0, -1, NaN, Infinity])('rejects invalid step length %s', (step) => {
    expect(() => safeDistance(50, 500, 40, step)).toThrow();
  });

  it('fails explicitly when intermediate values exceed numerical range', () => {
    expect(() => safeDistance(Number.MAX_VALUE, Number.MAX_VALUE, 40)).toThrow();
  });
});
