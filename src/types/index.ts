// =========================================================
// TypeScript Types for PrintLab Calculator
// =========================================================

// Label Product Configuration
export interface LabelProduct {
  id: string;
  label: string;
  maxLanes: number;
  labelsPerClick: number;
  extraClicks: number;
  isCustom?: boolean;
}

// Flowpack Configuration
export interface FlowpackConfig {
  maxLanesTotal: number;
  kgPoints: number[];
  clicks1: number[];
  meters1: number[];
  clicks3: number[];
  meters3: number[];
}

// Candy Jar Override Entry
export interface JarOverride {
  kg: number;
  clicks: number;
  meters?: number;
}

// Candy Jar Configuration
export interface JarConfig {
  midi: Record<number, JarOverride>;
  maxi: Record<number, JarOverride>;
  wrappersPerJar: { midi: number; maxi: number };
  piecesPerKg: number;
  wrappersPerClick: number;
  clickLengthM: number;
}

// UV Substrate Baseline
export interface SubstrateBaseline {
  recommendedGradient: number;
  recommendedMinUV: number;
  notes: string;
  riskLevel: 'low' | 'medium' | 'high';
}

// UV Coating Modifier
export interface CoatingModifier {
  gradientAdd: number;
  minUVAdd: number;
  noteTag: string;
}

// Corona/UV Machine Limits
export interface MachineLimits {
  speedMin: number;
  speedMax: number;
  uvMinMin: number;
  uvMinMax: number;
  gradientMin: number;
  gradientMax: number;
}

// Design Row State (for Label/Flowpack calculators)
export interface DesignRow {
  id: string;
  name: string;
  totalLabels: number;
  lanes: number;
}

// Flowpack Design Row
export interface FlowpackDesignRow {
  id: string;
  name: string;
  kg: number;
  lanes: number;
}

// Lane Entry for Results
export interface LaneEntry {
  designName: string;
  laneIndex: number;
  required: number;
}

// Result Row for Display
export interface ResultRow {
  lane: number;
  designName: string;
  required: number;
  labelsPerClick: number;
  totalClicks: number;
  produced: number;
  waste: number;
}

// Calculator Tab Types
export type CalculatorTab = 'label' | 'flowpack' | 'candyjar' | 'coronauv' | 'rolllength';

// Storage Keys
export const STORAGE_KEYS = {
  LABEL_PRODUCTS: 'printlab_label_products',
  FLOWPACK_CONFIG: 'printlab_flowpack_config',
  JAR_CONFIG: 'printlab_jar_config',
  UV_CONFIG: 'printlab_uv_config',
} as const;

// Product Manager State
export interface ProductManagerState {
  isOpen: boolean;
  editingProduct: LabelProduct | null;
}

// UV Calculation Inputs
export interface UVCalculationInputs {
  speedMpm: number;
  substrate: string;
  coating: string;
  jobType: string;
  bulbCondition: string;
  overrides: {
    enabled: boolean;
    uvMinW?: number;
    gradient?: number;
  };
}

// UV Calculation Result
export interface UVCalculationResult {
  uvMin: { value: number; source: 'recommended' | 'manual' };
  gradient: { value: number; source: 'recommended' | 'manual' };
  predictedWatts: number;
  notes: string;
  warnings: Array<{
    level: 'info' | 'warn' | 'danger';
    message: string;
  }>;
}
