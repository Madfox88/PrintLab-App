// DC330 Mini UV Calculator with Heat-Limit Safety

export interface Dc330UvInput {
  speedMpm: number;
  substrate: string;
  coating: string;
}

export interface Dc330UvOutput {
  targetUVRaw: number;
  targetUVDisplay: number | null;
  recommendedMinUV: number;
  recommendedGradient: number;
  predictedUVRaw: number;
  predictedUV: number;
  heatLimited: boolean;
  recommendedMaxSpeed: number | null;
  warnings: string[];
  speedZero: boolean;
}

type ProcessType = 'VARNISH' | 'LAMINATION';

// Helper functions
const ceilToStep = (value: number, step: number) => Math.ceil(value / step) * step;
const floorToStep = (value: number, step: number) => Math.floor(value / step) * step;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

// Substrate base UV reference at 20 m/min (W)
export const substrateBaseUvRef: Record<string, number> = {
  'CA PP UCO White': 2600,
  'CA PP UCO Clear': 2500,
  'PP Silver FTC 50': 3000,
  'PP BlueGray': 2700,
  'Forest PE White FTC 85': 3200,
  'Forest PE Clear FTC 85': 3100,
  'SYN-BOPP White 20': 2600,
  'SYN-BOPP Metallic 20': 3000,
  'SYN-BOPP Clear 20': 2400,
  'SYN-BOPP Mat Peach 20': 2900,
  'SYN-BOPP Mat 20': 2800,
};

// Coating modifiers (additive W @ 20 m/min)
export const coatingModifiers: Record<string, number> = {
  'UV Varnish – Standard Gloss': 300,
  'UV Laminating Adhesive – Standard': 700,
  'UV Laminating Adhesive – Heavy / Premium': 900,
};

// Thermal gradient caps by substrate and process type
const SYN_BOPP_20_SUBSTRATES = [
  'SYN-BOPP White 20',
  'SYN-BOPP Metallic 20',
  'SYN-BOPP Clear 20',
  'SYN-BOPP Mat Peach 20',
  'SYN-BOPP Mat 20',
];

export const maxGradientThermalByProcess: Record<string, Record<ProcessType, number>> = {};

// Initialize thermal caps for SYN-BOPP 20 substrates
SYN_BOPP_20_SUBSTRATES.forEach((substrate) => {
  maxGradientThermalByProcess[substrate] = {
    VARNISH: 500, // no thermal cap for varnish
    LAMINATION: 50, // hard cap at 50 for lamination
  };
});

// Derive process type from coating
function getProcessType(coating: string): ProcessType {
  if (coating === 'UV Varnish – Standard Gloss') {
    return 'VARNISH';
  }
  return 'LAMINATION';
}

// Get thermal gradient cap for substrate and process type
function getMaxGradientThermal(substrate: string, processType: ProcessType): number {
  return maxGradientThermalByProcess[substrate]?.[processType] ?? 500;
}

// Check if substrate is SYN-BOPP 20 family
function isSynBopp20(substrate: string): boolean {
  return SYN_BOPP_20_SUBSTRATES.includes(substrate);
}

export function calculateDc330Uv(input: Dc330UvInput): Dc330UvOutput {
  const { speedMpm, substrate, coating } = input;

  // Handle speed = 0
  if (speedMpm === 0) {
    return {
      targetUVRaw: 0,
      targetUVDisplay: null,
      recommendedMinUV: 1000,
      recommendedGradient: 50,
      predictedUVRaw: 1000,
      predictedUV: 1000,
      heatLimited: false,
      recommendedMaxSpeed: null,
      warnings: ['Web not moving (speed = 0).'],
      speedZero: true,
    };
  }

  // Derive process type
  const processType = getProcessType(coating);

  // Compute UV_ref_combo
  const substrateBase = substrateBaseUvRef[substrate] ?? 0;
  const coatingMod = coatingModifiers[coating] ?? 0;
  const uvRefCombo = substrateBase + coatingMod;

  // Compute target UV power
  const targetUVRaw = uvRefCombo * (speedMpm / 20);
  const targetUVDisplay = ceilToStep(targetUVRaw, 100);

  // Compute cure-based gradient (before thermal caps)
  const gradientRaw = targetUVRaw / speedMpm;
  const gradientCure = clamp(ceilToStep(gradientRaw, 50), 50, 500);

  // Apply thermal cap
  const maxGradientThermal = getMaxGradientThermal(substrate, processType);
  const recommendedGradient = Math.min(gradientCure, maxGradientThermal);
  const heatLimited = recommendedGradient < gradientCure;

  // Compute recommended MinUV
  const recommendedMinUV = clamp(ceilToStep(1000, 100), 1000, 3000);

  // Predict achievable UV at speed
  let predictedUVRaw = Math.max(recommendedMinUV, speedMpm * recommendedGradient);
  predictedUVRaw = Math.min(predictedUVRaw, 3000);
  const predictedUV = ceilToStep(predictedUVRaw, 100);

  // Build warnings
  const warnings: string[] = [];

  // Heat-limited warnings
  if (heatLimited) {
    warnings.push(
      'HEAT-LIMITED: Gradient capped to prevent web softening/curling/cutting. If bonding/cure is insufficient: reduce speed, reduce coat weight, add cooling, or change adhesive.'
    );
    if (isSynBopp20(substrate) && processType === 'LAMINATION') {
      warnings.push('CURL RISK: Thin BOPP may curl after UV due to heat. Keep gradient low and maximize cooling after UV.');
    }
  }

  // Determine if target is met
  let recommendedMaxSpeed: number | null = null;

  if (predictedUVRaw < targetUVRaw) {
    const bestGradient = 500;

    if (targetUVRaw > 3000) {
      recommendedMaxSpeed = null;
      if (!heatLimited) {
        warnings.push('Power capped at 3000 W; target UV cannot be reached at any speed with this UV_ref.');
      }
    } else {
      const maxSpeedRaw = targetUVRaw / bestGradient;
      const step = 0.5;
      recommendedMaxSpeed = clamp(floorToStep(maxSpeedRaw, step), 0, 40);
      if (!heatLimited) {
        warnings.push(`Reduce speed to ≤ ${recommendedMaxSpeed} m/min for proper curing.`);
      }
    }

    // Additional power/gradient warnings (only if not heat-limited)
    if (!heatLimited) {
      if (recommendedGradient === 500 && predictedUVRaw < targetUVRaw) {
        warnings.push('Gradient capped at 500; target UV cannot be reached at this speed.');
      }
      if (predictedUVRaw === 3000 && (predictedUVRaw < targetUVRaw || targetUVRaw > 3000)) {
        warnings.push('Power capped at 3000 W; target UV cannot be reached at this speed.');
      }
    }
  }

  return {
    targetUVRaw,
    targetUVDisplay,
    recommendedMinUV,
    recommendedGradient,
    predictedUVRaw,
    predictedUV,
    heatLimited,
    recommendedMaxSpeed,
    warnings,
    speedZero: false,
  };
}
