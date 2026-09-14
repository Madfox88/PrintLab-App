import type { JarConfig } from '../types';

// Candy Jar Configuration
export const JAR_CONFIG: JarConfig = {
  midi: {
    12: { kg: 2.5, clicks: 32 },
    24: { kg: 4.5, clicks: 32 },
    48: { kg: 9, clicks: 59 },
    96: { kg: 18, clicks: 112 },
    324: { kg: 65, clicks: 326 },
    648: { kg: 122, clicks: 667 },
    1296: { kg: 244, clicks: 1293 },
  },
  maxi: {
    12: { kg: 5, clicks: 32 },
    24: { kg: 10, clicks: 59 },
    48: { kg: 20, clicks: 112 },
    96: { kg: 40, clicks: 214 },
    324: { kg: 122, clicks: 667 },
    648: { kg: 260, clicks: 1408 },
    1296: { kg: 517, clicks: 8032 },
  },
  wrappersPerJar: { midi: 40, maxi: 85 },
  piecesPerKg: 190,
  wrappersPerClick: 45,
  clickLengthM: 1,
};

export const JAR_KG_ADJUSTMENT_PER_JOB = 2;
export const JAR_REFERENCE_STOP_OFFSET_M = 15;

export function computeJarMeters(clicks: number): number {
  return Math.max(Math.ceil(clicks), 0);
}

// Calculate jar results
export function calculateJarResults(
  productType: 'midi' | 'maxi',
  jars: number
): {
  kg: number;
  adjustmentKg: number;
  totalKg: number;
  clicks: number;
  meters: number;
  referenceStop: number;
} | null {
  if (!Number.isFinite(jars) || jars <= 0) {
    return null;
  }

  const overrides = JAR_CONFIG[productType];
  const adjustmentWrappers = JAR_KG_ADJUSTMENT_PER_JOB * JAR_CONFIG.piecesPerKg;

  // Check for override
  if (overrides[jars]) {
    const override = overrides[jars];
    const clicks = Math.ceil(
      override.clicks + adjustmentWrappers / JAR_CONFIG.wrappersPerClick
    );
    const meters = computeJarMeters(clicks);
    return {
      kg: override.kg,
      adjustmentKg: JAR_KG_ADJUSTMENT_PER_JOB,
      totalKg: override.kg + JAR_KG_ADJUSTMENT_PER_JOB,
      clicks,
      meters,
      referenceStop: Math.max(meters - JAR_REFERENCE_STOP_OFFSET_M, 0),
    };
  }

  // Calculate from formula
  const piecesPerJar = JAR_CONFIG.wrappersPerJar[productType];
  const wrappers = jars * piecesPerJar;

  const exactKg = wrappers / JAR_CONFIG.piecesPerKg;
  const kg = Math.round(exactKg * 10) / 10;

  const baseClicks = (wrappers + adjustmentWrappers) / JAR_CONFIG.wrappersPerClick;
  const safetyFactor = productType === 'midi' ? 1.18 : 1.22;
  const clicks = Math.ceil(baseClicks * safetyFactor);

  const meters = computeJarMeters(clicks);

  return {
    kg,
    adjustmentKg: JAR_KG_ADJUSTMENT_PER_JOB,
    totalKg: kg + JAR_KG_ADJUSTMENT_PER_JOB,
    clicks,
    meters,
    referenceStop: Math.max(meters - JAR_REFERENCE_STOP_OFFSET_M, 0),
  };
}
