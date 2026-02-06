import type { FlowpackConfig } from '../types';

// Flowpack Configuration
export const FLOWPACK_CONFIG: FlowpackConfig = {
  maxLanesTotal: 3,
  kgPoints: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 75, 100],
  // "1 FP pr lane" (mix mode)
  clicks1: [90, 165, 235, 315, 385, 455, 530, 605, 671, 830, 1125, 1495],
  meters1: [80, 150, 220, 295, 360, 435, 505, 580, 645, 795, 1090, 1440],
  // "3 ens FP" (same design on all 3 lanes)
  clicks3: [35, 60, 85, 110, 135, 155, 180, 205, 230, 280, 380, 500],
  meters3: [25, 45, 70, 95, 115, 140, 165, 190, 210, 260, 360, 475],
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

// Finalize flowpack calculation with rounding
export function flowpackFinalize(base: { clicks: number; meters: number }): {
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

  const clicks = Math.ceil(baseClicks);
  const mPerClick = baseMeters / baseClicks;
  const meters = Math.round((clicks * mPerClick) / 5) * 5;

  return { clicks, meters };
}
