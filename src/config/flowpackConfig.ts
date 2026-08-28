import type { FlowpackConfig } from '../types';

// Flowpack Configuration
export const FLOWPACK_CONFIG: FlowpackConfig = {
  maxLanesTotal: 3,
  kgPoints: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 75, 100],
  // "1 FP pr lane" (mix mode), rebuilt for 45-layout yield (scaled by 48/45)
  clicks1: [96, 176, 251, 336, 411, 486, 566, 646, 716, 886, 1200, 1595],
  meters1: [86, 160, 235, 315, 384, 464, 539, 619, 688, 848, 1163, 1536],
  // "3 ens FP" (same design on all 3 lanes), rebuilt for 45-layout yield (scaled by 48/45)
  clicks3: [38, 64, 91, 118, 144, 166, 192, 219, 246, 299, 406, 534],
  meters3: [27, 48, 75, 102, 123, 150, 176, 203, 224, 278, 384, 507],
};

// Interpolation function for flowpack calculations
export function flowpackInterpolate(
  kg: number,
  points: number[],
  clicksArr: number[],
  metersArr: number[]
): { clicks: number; meters: number } {
  const x = Number(kg);
  if (!Number.isFinite(x) || x <= 0) {
    return { clicks: 0, meters: 0 };
  }

  const firstKg = points[0];
  const lastKg = points[points.length - 1];

  // Below first point: proportional scaling
  if (x <= firstKg) {
    const factor = x / firstKg;
    return {
      clicks: clicksArr[0] * factor,
      meters: metersArr[0] * factor,
    };
  }

  // Above last point: proportional scaling
  if (x >= lastKg) {
    const factor = x / lastKg;
    return {
      clicks: clicksArr[clicksArr.length - 1] * factor,
      meters: metersArr[metersArr.length - 1] * factor,
    };
  }

  // Between: linear interpolation
  for (let i = 0; i < points.length - 1; i++) {
    const x0 = points[i];
    const x1 = points[i + 1];
    if (x >= x0 && x <= x1) {
      const t = (x - x0) / (x1 - x0);
      const c0 = clicksArr[i];
      const c1 = clicksArr[i + 1];
      const m0 = metersArr[i];
      const m1 = metersArr[i + 1];
      return {
        clicks: c0 + (c1 - c0) * t,
        meters: m0 + (m1 - m0) * t,
      };
    }
  }

  return { clicks: 0, meters: 0 };
}

// Extra clicks adjustment for new candy type (applies to all flowpack calculations)
export const EXTRA_CLICKS_PER_KG = 1; // +10 clicks per 10 kg of candy foil
export const SAFETY_CLICKS = 5; // flat safety margin added to the final result

// Finalize flowpack calculation with rounding.
// Adds 1 extra click per kg of candy plus a flat safety margin,
// and scales meters correspondingly.
export function flowpackFinalize(
  base: { clicks: number; meters: number },
  totalKg: number
): {
  clicks: number;
  meters: number;
} {
  const baseClicks = Number(base.clicks);
  const baseMeters = Number(base.meters);

  if (
    !Number.isFinite(baseClicks) ||
    baseClicks <= 0 ||
    !Number.isFinite(baseMeters) ||
    baseMeters <= 0
  ) {
    return { clicks: 0, meters: 0 };
  }

  const kg = Number.isFinite(totalKg) && totalKg > 0 ? totalKg : 0;
  const adjustedClicks = baseClicks + kg * EXTRA_CLICKS_PER_KG + SAFETY_CLICKS;

  const clicks = Math.ceil(adjustedClicks);
  const mPerClick = baseMeters / baseClicks;
  const meters = Math.round((clicks * mPerClick) / 5) * 5;

  return { clicks, meters };
}
