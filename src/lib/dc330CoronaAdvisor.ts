export type SurfaceCondition = 'Fresh/clean' | 'Aged/unknown' | 'Contamination risk';
export type CoronaConfidence = 'low' | 'medium' | 'high';
export type CoronaIntent = 'Coating/Overprint' | 'Lamination';

export interface CoronaAdviceInput {
  substrate: string;
  coating: string;
  surfaceCondition?: SurfaceCondition;
}

export interface CoronaAdvice {
  targetDyne: number;
  coronaRecommended: boolean;
  confidence: CoronaConfidence;
  notes: string[];
  warnings: string[];
}

interface SubstrateCoronaProfile {
  polymerGroup: 'PP' | 'PE';
  surfaceRisk: 'normal' | 'high';
  preTreated: boolean;
}

export const substrateCoronaProfile: Record<string, SubstrateCoronaProfile> = {
  'CA PP UCO White': { polymerGroup: 'PP', surfaceRisk: 'normal', preTreated: true },
  'CA PP UCO Clear': { polymerGroup: 'PP', surfaceRisk: 'normal', preTreated: true },
  'PP Silver FTC 50': { polymerGroup: 'PP', surfaceRisk: 'high', preTreated: true },
  'PP BlueGray': { polymerGroup: 'PP', surfaceRisk: 'normal', preTreated: true },
  'Forest PE White FTC 85': { polymerGroup: 'PE', surfaceRisk: 'normal', preTreated: true },
  'Forest PE Clear FTC 85': { polymerGroup: 'PE', surfaceRisk: 'normal', preTreated: true },
  'SYN-BOPP White 20': { polymerGroup: 'PP', surfaceRisk: 'normal', preTreated: true },
  'SYN-BOPP Metallic 20': { polymerGroup: 'PP', surfaceRisk: 'high', preTreated: true },
  'SYN-BOPP Clear 20': { polymerGroup: 'PP', surfaceRisk: 'normal', preTreated: true },
  'SYN-BOPP Mat Peach 20': { polymerGroup: 'PP', surfaceRisk: 'high', preTreated: true },
  'SYN-BOPP Mat 20': { polymerGroup: 'PP', surfaceRisk: 'high', preTreated: true },
};

const coatingIntent: Record<string, CoronaIntent> = {
  'UV Varnish – Standard Gloss': 'Coating/Overprint',
  'UV Laminating Adhesive – Standard': 'Lamination',
  'UV Laminating Adhesive – Heavy / Premium': 'Lamination',
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function calculateCoronaAdvice(input: CoronaAdviceInput): CoronaAdvice {
  const surfaceCondition: SurfaceCondition = input.surfaceCondition ?? 'Aged/unknown';
  const profile = substrateCoronaProfile[input.substrate];
  const intent = coatingIntent[input.coating] ?? 'Coating/Overprint';

  const baseTarget = profile?.polymerGroup === 'PE' ? 43 : 41;
  let adjustments = 0;
  if (intent === 'Lamination') adjustments += 1;
  if (profile?.surfaceRisk === 'high') adjustments += 1;
  if (surfaceCondition === 'Aged/unknown') adjustments += 1;
  if (surfaceCondition === 'Contamination risk') adjustments += 2;

  const targetDyne = clamp(baseTarget + adjustments, 38, 46);

  let coronaRecommended = true;
  let confidence: CoronaConfidence = 'medium';

  if (profile?.preTreated) {
    coronaRecommended =
      surfaceCondition !== 'Fresh/clean' || profile.surfaceRisk === 'high' || intent === 'Lamination';

    confidence =
      surfaceCondition === 'Fresh/clean' && profile.surfaceRisk === 'normal' && intent === 'Coating/Overprint'
        ? 'high'
        : 'medium';
  } else {
    coronaRecommended = true;
    confidence = 'high';
  }

  const notes: string[] = ['Measure surface energy with dyne pens before production.'];
  if (coronaRecommended) {
    notes.push('Apply corona until dyne ≥ target; re-test across the web.');
  } else {
    notes.push('Corona likely not required, but verify dyne before running.');
  }

  const warnings: string[] = [];
  if (intent === 'Lamination' && targetDyne < 42) {
    warnings.push('Lamination is sensitive; ensure dyne meets target to avoid bond failure.');
  }
  if (profile?.surfaceRisk === 'high') {
    warnings.push('High-risk surface (matte/metallized/soft-touch): adhesion may require higher dyne and careful testing.');
  }
  if (surfaceCondition !== 'Fresh/clean') {
    warnings.push('Aged/handled material can lose treatment; verify dyne and consider corona refresh.');
  }

  return { targetDyne, coronaRecommended, confidence, notes, warnings };
}
