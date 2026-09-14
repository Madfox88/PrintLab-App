import { describe, expect, it } from 'vitest';
import { JAR_CONFIG, calculateJarResults } from './jarConfig';

describe('calculateJarResults', () => {
  it('recalibrates a fixed Midi row and includes the 2 kg job adjustment', () => {
    const result = calculateJarResults('midi', 12);

    expect(JAR_CONFIG.wrappersPerClick).toBe(45);
    expect(result).toEqual({
      kg: 2.5,
      adjustmentKg: 2,
      totalKg: 4.5,
      clicks: 41,
      meters: 41,
      referenceStop: 26,
    });
  });

  it('uses the same rules for formula-based Maxi quantities', () => {
    const result = calculateJarResults('maxi', 10);

    expect(result).toEqual({
      kg: 4.5,
      adjustmentKg: 2,
      totalKg: 6.5,
      clicks: 34,
      meters: 34,
      referenceStop: 19,
    });
  });
});