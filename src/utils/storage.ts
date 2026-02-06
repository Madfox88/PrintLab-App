import type { LabelProduct } from '../types';
import { DEFAULT_LABEL_PRODUCTS } from '../config/labelProducts';
import { STORAGE_KEYS } from '../types';

/**
 * Load products from localStorage, falling back to defaults
 */
export function loadLabelProducts(): LabelProduct[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.LABEL_PRODUCTS);
    if (stored) {
      const parsed = JSON.parse(stored) as LabelProduct[];
      // Merge with defaults - keep defaults, add custom products
      const defaultIds = new Set(DEFAULT_LABEL_PRODUCTS.map((p) => p.id));
      const customProducts = parsed.filter((p) => p.isCustom || !defaultIds.has(p.id));
      return [...DEFAULT_LABEL_PRODUCTS, ...customProducts];
    }
  } catch (e) {
    console.error('Failed to load products from localStorage:', e);
  }
  return [...DEFAULT_LABEL_PRODUCTS];
}

/**
 * Save products to localStorage (only saves custom products)
 */
export function saveLabelProducts(products: LabelProduct[]): void {
  try {
    const customProducts = products.filter((p) => p.isCustom);
    localStorage.setItem(STORAGE_KEYS.LABEL_PRODUCTS, JSON.stringify(customProducts));
  } catch (e) {
    console.error('Failed to save products to localStorage:', e);
  }
}

/**
 * Export all products to JSON
 */
export function exportProductsToJson(products: LabelProduct[]): string {
  return JSON.stringify(products, null, 2);
}

/**
 * Import products from JSON
 */
export function importProductsFromJson(json: string): LabelProduct[] | null {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return null;
    
    // Validate each product has required fields
    const valid = parsed.every(
      (p) =>
        typeof p.id === 'string' &&
        typeof p.label === 'string' &&
        typeof p.maxLanes === 'number' &&
        typeof p.labelsPerClick === 'number' &&
        typeof p.extraClicks === 'number'
    );
    
    if (!valid) return null;
    return parsed as LabelProduct[];
  } catch {
    return null;
  }
}

/**
 * Reset to default products
 */
export function resetToDefaultProducts(): LabelProduct[] {
  localStorage.removeItem(STORAGE_KEYS.LABEL_PRODUCTS);
  return [...DEFAULT_LABEL_PRODUCTS];
}
