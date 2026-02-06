import type {
  MachineLimits,
  SubstrateBaseline,
  CoatingModifier,
  UVCalculationInputs,
  UVCalculationResult,
} from '../types';

// Machine limits (DC330 Mini)
export const MACHINE_LIMITS: MachineLimits = {
  speedMin: 0,
  speedMax: 40,
  uvMinMin: 1000,
  uvMinMax: 3000,
  gradientMin: 50,
  gradientMax: 500,
};

// Warning thresholds
export const WARNING_THRESHOLDS = {
  speedLimitedWattsDanger: 3000,
  speedLimitedWattsWarn: 2900,
  lowSpeedMpm: 10,
  lowEnergyWatts: 1400,
  bulbEolExtraPercent: 0.15,
};

// Substrates list
export const SUBSTRATES = [
  'CA PP UCO White',
  'CA PP UCO Clear',
  'PP Silver FTC 50',
  'PP BlueGray',
  'Forest PE White FTC 85',
  'Forest PE Clear FTC 85',
  'SYN-BOPP White 20',
  'SYN-BOPP Metallic 20',
  'SYN-BOPP Clear 20',
  'SYN-BOPP Mat Peach 20',
  'SYN-BOPP Mat 20',
];

// Coatings list
export const COATINGS = ['UV Varnish', 'UV Lamination Adhesive', 'Cold-foil Adhesive'];

// Substrate baselines
export const SUBSTRATE_BASELINE: Record<string, SubstrateBaseline> = {
  'CA PP UCO White': {
    recommendedGradient: 220,
    recommendedMinUV: 1600,
    notes: 'Baseline for coated PP (white). Adjust after cure tests.',
    riskLevel: 'medium',
  },
  'CA PP UCO Clear': {
    recommendedGradient: 240,
    recommendedMinUV: 1700,
    notes: 'Baseline for coated PP (clear). Clear films can be trickier—watch tack/odor.',
    riskLevel: 'medium',
  },
  'PP Silver FTC 50': {
    recommendedGradient: 260,
    recommendedMinUV: 1800,
    notes: 'Silver facestock—monitor reflectivity + cure on dense ink/varnish areas.',
    riskLevel: 'medium',
  },
  'PP BlueGray': {
    recommendedGradient: 240,
    recommendedMinUV: 1700,
    notes: 'Colored PP baseline. Confirm cure on heavy coverage.',
    riskLevel: 'medium',
  },
  'Forest PE White FTC 85': {
    recommendedGradient: 280,
    recommendedMinUV: 1900,
    notes: 'PE typically needs more surface energy management; verify adhesion/cure.',
    riskLevel: 'high',
  },
  'Forest PE Clear FTC 85': {
    recommendedGradient: 300,
    recommendedMinUV: 2000,
    notes: 'Clear PE baseline. If bonding issues appear, review corona + adhesive choice.',
    riskLevel: 'high',
  },
  'SYN-BOPP White 20': {
    recommendedGradient: 240,
    recommendedMinUV: 1700,
    notes: 'SYN-BOPP 20µ white baseline. Refine after your lamp + speed trials.',
    riskLevel: 'medium',
  },
  'SYN-BOPP Metallic 20': {
    recommendedGradient: 270,
    recommendedMinUV: 1900,
    notes: 'Metallized film can behave differently (reflection/heat). Verify cure carefully.',
    riskLevel: 'high',
  },
  'SYN-BOPP Clear 20': {
    recommendedGradient: 250,
    recommendedMinUV: 1800,
    notes: 'SYN-BOPP 20µ clear baseline. Watch curl/tack on long runs.',
    riskLevel: 'medium',
  },
  'SYN-BOPP Mat Peach 20': {
    recommendedGradient: 260,
    recommendedMinUV: 1900,
    notes: 'Matt/peach-touch style: often needs more energy. Validate scuff resistance.',
    riskLevel: 'high',
  },
  'SYN-BOPP Mat 20': {
    recommendedGradient: 260,
    recommendedMinUV: 1900,
    notes: 'Matt film baseline: validate cure on solid areas and after lamination.',
    riskLevel: 'high',
  },
};

// Coating modifiers
export const COATING_MODIFIER: Record<string, CoatingModifier> = {
  'UV Varnish': { gradientAdd: 0, minUVAdd: 0, noteTag: 'Varnish' },
  'UV Lamination Adhesive': {
    gradientAdd: 30,
    minUVAdd: 150,
    noteTag: 'Adhesive (lamination)',
  },
  'Cold-foil Adhesive': {
    gradientAdd: 40,
    minUVAdd: 200,
    noteTag: 'Adhesive (cold-foil)',
  },
};

// Helper functions
function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

function getRecipe(substrate: string, coating: string) {
  const base = SUBSTRATE_BASELINE[substrate];
  const mod = COATING_MODIFIER[coating];

  if (!base || !mod) {
    return {
      recommendedGradient: 250,
      recommendedMinUV: 1800,
      notes: 'Default recipe (fallback).',
      riskLevel: 'medium' as const,
    };
  }

  return {
    recommendedGradient: base.recommendedGradient + mod.gradientAdd,
    recommendedMinUV: base.recommendedMinUV + mod.minUVAdd,
    notes: `${mod.noteTag}: ${base.notes}`,
    riskLevel: base.riskLevel,
  };
}

// Main calculation function
export function calculateUV(inputs: UVCalculationInputs): UVCalculationResult {
  const speed = clamp(inputs.speedMpm, MACHINE_LIMITS.speedMin, MACHINE_LIMITS.speedMax);

  const recipe = getRecipe(inputs.substrate, inputs.coating);

  const uvMinManual = inputs.overrides.enabled && typeof inputs.overrides.uvMinW === 'number';
  const gradManual = inputs.overrides.enabled && typeof inputs.overrides.gradient === 'number';

  const uvMinValue = uvMinManual ? inputs.overrides.uvMinW! : recipe.recommendedMinUV;
  const gradValue = gradManual ? inputs.overrides.gradient! : recipe.recommendedGradient;

  const uvMin = clamp(roundTo(uvMinValue, 100), MACHINE_LIMITS.uvMinMin, MACHINE_LIMITS.uvMinMax);
  const gradient = clamp(roundTo(gradValue, 10), MACHINE_LIMITS.gradientMin, MACHINE_LIMITS.gradientMax);

  const raw = Math.max(uvMin, speed * gradient);
  const predicted = clamp(raw, 0, MACHINE_LIMITS.uvMinMax);

  const warnings: UVCalculationResult['warnings'] = [];

  if (predicted >= WARNING_THRESHOLDS.speedLimitedWattsDanger) {
    warnings.push({
      level: 'danger',
      message: `Speed-limited: predicted UV hits ${MACHINE_LIMITS.uvMinMax}W. Reduce speed or verify cure at max.`,
    });
  } else if (predicted >= WARNING_THRESHOLDS.speedLimitedWattsWarn) {
    warnings.push({
      level: 'warn',
      message: `Near limit: predicted UV is ${predicted.toFixed(0)}W (≥ ${WARNING_THRESHOLDS.speedLimitedWattsWarn}W).`,
    });
  }

  if (speed <= WARNING_THRESHOLDS.lowSpeedMpm && predicted <= WARNING_THRESHOLDS.lowEnergyWatts) {
    warnings.push({
      level: 'warn',
      message: `Under-cure risk heuristic: low speed (${speed} m/min) + low predicted power (${predicted.toFixed(0)}W). Consider raising UV Min / Gradient or verify cure.`,
    });
  }

  if (inputs.bulbCondition === 'Near end-of-life') {
    const extra = Math.round(predicted * WARNING_THRESHOLDS.bulbEolExtraPercent);
    warnings.push({
      level: 'info',
      message: `Bulb near end-of-life: consider ~+${Math.round(WARNING_THRESHOLDS.bulbEolExtraPercent * 100)}% energy margin (≈ +${extra}W) and confirm cure.`,
    });
  }

  if (inputs.jobType === 'Setup test strip') {
    warnings.push({
      level: 'info',
      message: 'Setup mode: run a short test strip and confirm cure/adhesion before full production.',
    });
  }

  return {
    uvMin: { value: uvMin, source: uvMinManual ? 'manual' : 'recommended' },
    gradient: { value: gradient, source: gradManual ? 'manual' : 'recommended' },
    predictedWatts: predicted,
    notes: recipe.notes,
    warnings,
  };
}
