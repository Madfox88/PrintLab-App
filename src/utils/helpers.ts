// =========================================================
// Utility Functions for PrintLab Calculator
// =========================================================

/**
 * Clamp lanes to valid range
 */
export function clampLanes(value: number | string, maxLanes: number | null): number {
  const v = Number(value);
  if (!Number.isFinite(v) || v < 0) return 0;
  if (maxLanes != null && v > maxLanes) return maxLanes;
  return v;
}

/**
 * Format number with Danish locale (da-DK)
 */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('da-DK');
}

/**
 * Round up to the next multiple of 10
 */
export function roundUpToNext10(x: number): number {
  return Math.ceil(x / 10) * 10;
}

/**
 * Round to nearest multiple of 5
 */
export function roundToNearest5(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value / 5) * 5;
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Clamp a number to a range
 */
export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
