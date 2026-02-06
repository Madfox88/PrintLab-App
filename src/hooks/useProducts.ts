import { useState, useCallback } from 'react';
import type { LabelProduct } from '../types';
import { loadLabelProducts, saveLabelProducts } from '../utils/storage';
import { generateId } from '../utils/helpers';

export function useProducts() {
  const [products, setProducts] = useState<LabelProduct[]>(() => loadLabelProducts());

  const addProduct = useCallback((product: Omit<LabelProduct, 'id' | 'isCustom'>) => {
    const newProduct: LabelProduct = {
      ...product,
      id: generateId(),
      isCustom: true,
    };
    setProducts((prev) => {
      const updated = [...prev, newProduct];
      saveLabelProducts(updated);
      return updated;
    });
    return newProduct;
  }, []);

  const updateProduct = useCallback((id: string, updates: Partial<LabelProduct>) => {
    setProducts((prev) => {
      const updated = prev.map((p) => (p.id === id ? { ...p, ...updates } : p));
      saveLabelProducts(updated);
      return updated;
    });
  }, []);

  const deleteProduct = useCallback((id: string) => {
    setProducts((prev) => {
      const product = prev.find((p) => p.id === id);
      // Only allow deleting custom products
      if (!product?.isCustom) return prev;
      const updated = prev.filter((p) => p.id !== id);
      saveLabelProducts(updated);
      return updated;
    });
  }, []);

  const importProducts = useCallback((newProducts: LabelProduct[]) => {
    setProducts((prev) => {
      // Mark imported products as custom and generate new IDs
      const imported = newProducts.map((p) => ({
        ...p,
        id: generateId(),
        isCustom: true,
      }));
      const updated = [...prev, ...imported];
      saveLabelProducts(updated);
      return updated;
    });
  }, []);

  const resetProducts = useCallback(() => {
    const defaults = loadLabelProducts();
    setProducts(defaults);
    saveLabelProducts(defaults);
  }, []);

  return {
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    importProducts,
    resetProducts,
  };
}
