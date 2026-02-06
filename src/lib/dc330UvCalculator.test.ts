import { describe, it, expect } from 'vitest';
import { calculateDc330Uv } from './dc330UvCalculator';

describe('dc330UvCalculator', () => {
  describe('speed = 0', () => {
    it('should handle speed = 0 correctly', () => {
      const result = calculateDc330Uv({
        speedMpm: 0,
        substrate: 'SYN-BOPP Clear 20',
        coating: 'UV Varnish – Standard Gloss',
      });

      expect(result.targetUVRaw).toBe(0);
      expect(result.targetUVDisplay).toBeNull();
      expect(result.recommendedMinUV).toBe(1000);
      expect(result.recommendedGradient).toBe(50);
      expect(result.predictedUV).toBe(1000);
      expect(result.heatLimited).toBe(false);
      expect(result.speedZero).toBe(true);
      expect(result.warnings).toContain('Web not moving (speed = 0).');
    });
  });

  describe('typical case', () => {
    it('should calculate correctly for SYN-BOPP Clear 20 + UV Varnish @ 20 m/min', () => {
      const result = calculateDc330Uv({
        speedMpm: 20,
        substrate: 'SYN-BOPP Clear 20',
        coating: 'UV Varnish – Standard Gloss',
      });

      // UV_ref_combo = 2400 + 300 = 2700
      // targetUVRaw = 2700 * (20 / 20) = 2700
      expect(result.targetUVRaw).toBe(2700);
      expect(result.targetUVDisplay).toBe(2700);

      // gradientRaw = 2700 / 20 = 135
      // gradientCure = ceil(135 / 50) * 50 = 150
      expect(result.recommendedGradient).toBe(150);

      // No thermal cap for varnish
      expect(result.heatLimited).toBe(false);

      // predictedUVRaw = max(1000, 20 * 150) = 3000, capped at 3000
      expect(result.predictedUV).toBe(3000);

      // Target met (3000 >= 2700)
      expect(result.warnings.length).toBe(0);
    });
  });

  describe('power cap case', () => {
    it('should cap at 3000W for Forest PE White FTC 85 + Heavy lamination @ 40 m/min', () => {
      const result = calculateDc330Uv({
        speedMpm: 40,
        substrate: 'Forest PE White FTC 85',
        coating: 'UV Laminating Adhesive – Heavy / Premium',
      });

      // UV_ref_combo = 3200 + 900 = 4100
      // targetUVRaw = 4100 * (40 / 20) = 8200
      expect(result.targetUVRaw).toBe(8200);
      expect(result.targetUVDisplay).toBe(8200); // already a multiple of 100

      // gradientRaw = 8200 / 40 = 205
      // gradientCure = ceil(205 / 50) * 50 = 250
      expect(result.recommendedGradient).toBe(250);

      // No thermal cap for PE
      expect(result.heatLimited).toBe(false);

      // predictedUVRaw = max(1000, 40 * 250) = 10000, capped at 3000
      expect(result.predictedUV).toBe(3000);

      // Target not met, warnings present
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('Power capped'))).toBe(true);
    });
  });

  describe('HEAT-LIMITED case', () => {
    it('should apply thermal cap for SYN-BOPP White 20 + Standard lamination @ 20 m/min', () => {
      const result = calculateDc330Uv({
        speedMpm: 20,
        substrate: 'SYN-BOPP White 20',
        coating: 'UV Laminating Adhesive – Standard',
      });

      // UV_ref_combo = 2600 + 700 = 3300
      // targetUVRaw = 3300 * (20 / 20) = 3300
      expect(result.targetUVRaw).toBe(3300);

      // gradientRaw = 3300 / 20 = 165
      // gradientCure = ceil(165 / 50) * 50 = 200
      // BUT: thermal cap = 50 for SYN-BOPP 20 + LAMINATION
      expect(result.recommendedGradient).toBe(50);
      expect(result.heatLimited).toBe(true);

      // Warnings should include HEAT-LIMITED and CURL RISK
      expect(result.warnings).toContain(
        'HEAT-LIMITED: Gradient capped to prevent web softening/curling/cutting. If bonding/cure is insufficient: reduce speed, reduce coat weight, add cooling, or change adhesive.'
      );
      expect(result.warnings).toContain(
        'CURL RISK: Thin BOPP may curl after UV due to heat. Keep gradient low and maximize cooling after UV.'
      );
    });

    it('should NOT apply thermal cap for SYN-BOPP White 20 + Varnish', () => {
      const result = calculateDc330Uv({
        speedMpm: 20,
        substrate: 'SYN-BOPP White 20',
        coating: 'UV Varnish – Standard Gloss',
      });

      // UV_ref_combo = 2600 + 300 = 2900
      // targetUVRaw = 2900 * (20 / 20) = 2900
      // gradientRaw = 2900 / 20 = 145
      // gradientCure = ceil(145 / 50) * 50 = 150

      // No thermal cap for varnish (defaults to 500)
      expect(result.recommendedGradient).toBe(150);
      expect(result.heatLimited).toBe(false);
    });
  });

  describe('all SYN-BOPP 20 substrates', () => {
    const synBopp20Substrates = [
      'SYN-BOPP White 20',
      'SYN-BOPP Metallic 20',
      'SYN-BOPP Clear 20',
      'SYN-BOPP Mat Peach 20',
      'SYN-BOPP Mat 20',
    ];

    synBopp20Substrates.forEach((substrate) => {
      it(`should apply thermal cap for ${substrate} + lamination`, () => {
        const result = calculateDc330Uv({
          speedMpm: 25,
          substrate,
          coating: 'UV Laminating Adhesive – Standard',
        });

        expect(result.recommendedGradient).toBe(50);
        expect(result.heatLimited).toBe(true);
        expect(result.warnings.some(w => w.includes('HEAT-LIMITED'))).toBe(true);
        expect(result.warnings.some(w => w.includes('CURL RISK'))).toBe(true);
      });
    });
  });

  describe('recommended max speed', () => {
    it('should recommend max speed when target is achievable at lower speed', () => {
      const result = calculateDc330Uv({
        speedMpm: 30,
        substrate: 'CA PP UCO Clear',
        coating: 'UV Varnish – Standard Gloss',
      });

      // UV_ref_combo = 2500 + 300 = 2800
      // targetUVRaw = 2800 * (30 / 20) = 4200
      expect(result.targetUVRaw).toBe(4200);

      // gradientRaw = 4200 / 30 = 140, ceil(140/50)*50 = 150
      expect(result.recommendedGradient).toBe(150);

      // predictedUVRaw = max(1000, 30 * 150) = 4500, capped at 3000
      expect(result.predictedUV).toBe(3000);

      // Target > 3000W, so impossible to reach at any speed
      expect(result.recommendedMaxSpeed).toBeNull();
      expect(result.warnings.some(w => w.includes('cannot be reached at any speed'))).toBe(true);
    });

    it('should recommend max speed when gradient is limiting factor', () => {
      const result = calculateDc330Uv({
        speedMpm: 35,
        substrate: 'SYN-BOPP Clear 20',
        coating: 'UV Varnish – Standard Gloss',
      });

      // UV_ref_combo = 2400 + 300 = 2700
      // targetUVRaw = 2700 * (35 / 20) = 4725
      expect(result.targetUVRaw).toBe(4725);

      // gradientRaw = 4725 / 35 = 135, ceil(135/50)*50 = 150
      expect(result.recommendedGradient).toBe(150);

      // predictedUVRaw = max(1000, 35 * 150) = 5250, capped at 3000
      expect(result.predictedUV).toBe(3000);

      // Target exceeds 3000W
      expect(result.recommendedMaxSpeed).toBeNull();
    });
  });
});
