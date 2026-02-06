import { useState } from 'react';
import type { LabelProduct } from '../../types';
import { exportProductsToJson, importProductsFromJson } from '../../utils/storage';

interface ProductManagerProps {
  products: LabelProduct[];
  onClose: () => void;
  onAdd: (product: Omit<LabelProduct, 'id' | 'isCustom'>) => void;
  onUpdate: (id: string, updates: Partial<LabelProduct>) => void;
  onDelete: (id: string) => void;
  onImport: (products: LabelProduct[]) => void;
}

export function ProductManager({
  products,
  onClose,
  onAdd,
  onUpdate,
  onDelete,
  onImport,
}: ProductManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    label: '',
    maxLanes: 3,
    labelsPerClick: 36,
    extraClicks: 18,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.label.trim()) {
      alert('Please enter a product label.');
      return;
    }

    if (editingId) {
      onUpdate(editingId, formData);
      setEditingId(null);
    } else {
      onAdd(formData);
    }

    setFormData({ label: '', maxLanes: 3, labelsPerClick: 36, extraClicks: 18 });
    setShowAddForm(false);
  };

  const handleEdit = (product: LabelProduct) => {
    setFormData({
      label: product.label,
      maxLanes: product.maxLanes,
      labelsPerClick: product.labelsPerClick,
      extraClicks: product.extraClicks,
    });
    setEditingId(product.id);
    setShowAddForm(true);
  };

  const handleExport = () => {
    const json = exportProductsToJson(products);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'printlab-products.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const text = await file.text();
      const imported = importProductsFromJson(text);
      
      if (!imported) {
        alert('Invalid JSON format. Please check the file structure.');
        return;
      }
      
      onImport(imported);
      alert(`Successfully imported ${imported.length} products.`);
    };
    input.click();
  };

  const customProducts = products.filter((p) => p.isCustom);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">⚙️ Manage Products</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Action Buttons */}
          <div className="controls-row" style={{ marginBottom: '16px' }}>
            <button className="btn-success" onClick={() => setShowAddForm(true)}>
              + Add New Product
            </button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-secondary" onClick={handleExport}>
                📥 Export JSON
              </button>
              <button className="btn-secondary" onClick={handleImport}>
                📤 Import JSON
              </button>
            </div>
          </div>

          {/* Add/Edit Form */}
          {showAddForm && (
            <form onSubmit={handleSubmit} className="summary-box" style={{ marginBottom: '16px' }}>
              <div className="form-grid">
                <label>
                  Label name
                  <input
                    type="text"
                    value={formData.label}
                    onChange={(e) => setFormData((f) => ({ ...f, label: e.target.value }))}
                    placeholder="e.g., New Label 100 x 50 mm"
                  />
                </label>
                <label>
                  Max lanes
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={formData.maxLanes}
                    onChange={(e) => setFormData((f) => ({ ...f, maxLanes: Number(e.target.value) }))}
                  />
                </label>
                <label>
                  Labels per click
                  <input
                    type="number"
                    min="1"
                    value={formData.labelsPerClick}
                    onChange={(e) => setFormData((f) => ({ ...f, labelsPerClick: Number(e.target.value) }))}
                  />
                </label>
                <label>
                  Extra clicks (setup)
                  <input
                    type="number"
                    min="0"
                    value={formData.extraClicks}
                    onChange={(e) => setFormData((f) => ({ ...f, extraClicks: Number(e.target.value) }))}
                  />
                </label>
              </div>
              <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                <button type="submit" className="btn-success">
                  {editingId ? 'Update Product' : 'Add Product'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingId(null);
                    setFormData({ label: '', maxLanes: 3, labelsPerClick: 36, extraClicks: 18 });
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Custom Products List */}
          {customProducts.length > 0 ? (
            <>
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Custom Products ({customProducts.length})
              </h3>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Label</th>
                      <th className="right">Max Lanes</th>
                      <th className="right">Labels/Click</th>
                      <th className="right">Extra Clicks</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customProducts.map((product) => (
                      <tr key={product.id}>
                        <td>{product.label}</td>
                        <td className="right">{product.maxLanes}</td>
                        <td className="right">{product.labelsPerClick}</td>
                        <td className="right">{product.extraClicks}</td>
                        <td className="row-actions">
                          <button className="btn-secondary" onClick={() => handleEdit(product)}>
                            Edit
                          </button>
                          <button className="btn-danger" onClick={() => onDelete(product.id)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="muted">No custom products yet. Add one above or import from JSON.</p>
          )}

          <div style={{ marginTop: '16px' }}>
            <p className="muted">
              Default products ({products.filter((p) => !p.isCustom).length}) cannot be edited or deleted.
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
