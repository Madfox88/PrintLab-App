import type { JarConfig } from '../types';

// Candy Jar Configuration
export const JAR_CONFIG: JarConfig = {
  midi: {
    12: { kg: 2.5, clicks: 30, meters: 25 },
    24: { kg: 4.5, clicks: 30, meters: 25 },
    48: { kg: 9, clicks: 55, meters: 45 },
    96: { kg: 18, clicks: 105, meters: 95 },
    324: { kg: 65, clicks: 305 },
    648: { kg: 122, clicks: 625 },
    1296: { kg: 244, clicks: 1212 },
  },
  maxi: {
    12: { kg: 5, clicks: 30, meters: 25 },
    24: { kg: 10, clicks: 55, meters: 45 },
    48: { kg: 20, clicks: 105, meters: 95 },
    96: { kg: 40, clicks: 200, meters: 190 },
    324: { kg: 122, clicks: 625 },
    648: { kg: 260, clicks: 1320 },
    1296: { kg: 517, clicks: 7530 },
  },
  wrappersPerJar: { midi: 40, maxi: 85 },
  piecesPerKg: 190,
  wrappersPerClick: 48,
  clickLengthM: 0.976,
};

// Calculate meters from clicks
export function computeJarMeters(clicks: number): number {
  const raw = clicks * JAR_CONFIG.clickLengthM;
  return Math.round(raw / 5) * 5;
}

// Calculate jar results
export function calculateJarResults(
  productType: 'midi' | 'maxi',
  jars: number
): { kg: number; clicks: number; meters: number } | null {
  if (!Number.isFinite(jars) || jars <= 0) {
    return null;
  }

  const overrides = JAR_CONFIG[productType];

  // Check for override
  if (overrides[jars]) {
    const override = overrides[jars];
    return {
      kg: override.kg,
      clicks: override.clicks,
      meters: override.meters ?? computeJarMeters(override.clicks),
    };
  }

  // Calculate from formula
  const piecesPerJar = JAR_CONFIG.wrappersPerJar[productType];
  const wrappers = jars * piecesPerJar;

  const exactKg = wrappers / JAR_CONFIG.piecesPerKg;
  const kg = Math.round(exactKg * 10) / 10;

  const baseClicks = wrappers / JAR_CONFIG.wrappersPerClick;
  const safetyFactor = productType === 'midi' ? 1.18 : 1.22;
  const clicks = Math.ceil(baseClicks * safetyFactor);

  const meters = computeJarMeters(clicks);

  return { kg, clicks, meters };
}
