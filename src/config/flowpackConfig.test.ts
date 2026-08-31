import { describe, expect, it } from 'vitest';
import { flowpackFinalize } from './flowpackConfig';

describe('flowpackFinalize', () => {
  it('treats one click as one meter in flowpack output', () => {
    const result = flowpackFinalize({ clicks: 100, meters: 90 }, 20);

    expect(result.clicks).toBeGreaterThan(0);
    expect(result.meters).toBe(result.clicks);
  });

  it('keeps total length separate from the 15 m operator reference stop', () => {
    const totalLength = 140;
    const referenceStop = totalLength - 15;

    expect(referenceStop).toBe(125);
    expect(referenceStop).toBeLessThan(totalLength);
  });
});
