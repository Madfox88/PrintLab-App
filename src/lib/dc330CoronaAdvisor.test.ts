import { describe, expect, it } from 'vitest';
import { calculateCoronaAdvice } from './dc330CoronaAdvisor';

describe('calculateCoronaAdvice', () => {
  it('PP normal + varnish, fresh -> target around 41, coronaRecommended false, notes include measure', () => {
    const result = calculateCoronaAdvice({
      substrate: 'CA PP UCO White',
      coating: 'UV Varnish – Standard Gloss',
      surfaceCondition: 'Fresh/clean',
    });

    expect(result.targetDyne).toBeGreaterThanOrEqual(40);
    expect(result.targetDyne).toBeLessThanOrEqual(42);
    expect(result.coronaRecommended).toBe(false);
    expect(result.notes.some((n) => n.toLowerCase().includes('measure'))).toBe(true);
  });

  it('PP high-risk + lamination, aged -> target near 44–46, corona recommended, warnings present', () => {
    const result = calculateCoronaAdvice({
      substrate: 'SYN-BOPP Metallic 20',
      coating: 'UV Laminating Adhesive – Heavy / Premium',
      surfaceCondition: 'Aged/unknown',
    });

    expect(result.targetDyne).toBeGreaterThanOrEqual(44);
    expect(result.targetDyne).toBeLessThanOrEqual(46);
    expect(result.coronaRecommended).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('PE + lamination -> target higher than PP (>=44)', () => {
    const result = calculateCoronaAdvice({
      substrate: 'Forest PE White FTC 85',
      coating: 'UV Laminating Adhesive – Standard',
      surfaceCondition: 'Aged/unknown',
    });

    expect(result.targetDyne).toBeGreaterThanOrEqual(44);
  });
});
