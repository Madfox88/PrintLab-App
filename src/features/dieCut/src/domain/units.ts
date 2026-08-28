const CYLINDER_TOOTH_PITCH_MM = 3.175;

export const CYLINDER_CIRCUMFERENCE_TOLERANCE_MM = 0.5;

export function circumferenceFromTeeth(teeth: number): number {
  return teeth * CYLINDER_TOOTH_PITCH_MM;
}

export function nearlyEqual(a: number, b: number, tolerance = 0.001): boolean {
  return Math.abs(a - b) <= tolerance;
}

export function parseLocalizedNumber(value: string): number {
  const normalized = value.trim().replace(/\s+/g, '').replace(',', '.');
  if (normalized === '') return Number.NaN;
  return Number.parseFloat(normalized);
}

export function formatMm(value: number): string {
  return `${value.toFixed(1)} mm`;
}