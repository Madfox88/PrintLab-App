import { useState, useMemo } from 'react';
import type { DesignRow, LaneEntry, ResultRow } from '../../types';
import { formatNumber, roundUpToNext10, clampLanes, generateId } from '../../utils';
import { useProducts } from '../../hooks';
import { ProductManager } from '../ProductManager/ProductManager';

export function LabelCalculator() {
  const { products, addProduct, updateProduct, deleteProduct, importProducts } = useProducts();
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
  const [designs, setDesigns] = useState<DesignRow[]>([
    { id: generateId(), name: 'Design 1', totalLabels: 0, lanes: 0 },
  ]);
  const [showProductManager, setShowProductManager] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) || products[0],
    [products, selectedProductId]
  );

  // Calculate effective lanes (clamped to maxLanes)
  const designsWithEffectiveLanes = useMemo(() => {
    if (!selectedProduct) return designs.map((d) => ({ ...d, effectiveLanes: 0 }));

    let remaining = selectedProduct.maxLanes;
    return designs.map((design) => {
      const clamped = clampLanes(design.lanes, remaining);
      remaining -= clamped;
      return { ...design, effectiveLanes: clamped };
    });
  }, [designs, selectedProduct]);

  // Check if lanes were clamped
  const lanesClamped = useMemo(() => {
    return designsWithEffectiveLanes.some((d, i) => d.effectiveLanes !== designs[i].lanes && designs[i].lanes > 0);
  }, [designs, designsWithEffectiveLanes]);

  const usedLanes = useMemo(
    () => designsWithEffectiveLanes.reduce((sum, d) => sum + d.effectiveLanes, 0),
    [designsWithEffectiveLanes]
  );
  const maxLanes = selectedProduct?.maxLanes ?? 0;
  const remainingLanes = Math.max(maxLanes - usedLanes, 0);
  const laneUsagePercent = maxLanes > 0 ? Math.min((usedLanes / maxLanes) * 100, 100) : 0;

  // Build lane entries
  const laneEntries = useMemo((): LaneEntry[] => {
    const entries: LaneEntry[] = [];
    designsWithEffectiveLanes.forEach((design) => {
      if (design.totalLabels <= 0 || design.effectiveLanes <= 0) return;
      const perLane = Math.round(design.totalLabels / design.effectiveLanes);
      for (let i = 1; i <= design.effectiveLanes; i++) {
        entries.push({ designName: design.name, laneIndex: i, required: perLane });
      }
    });
    return entries;
  }, [designsWithEffectiveLanes]);

  // Calculate results
  const results = useMemo((): {
    totalClicks: number;
    rows: ResultRow[];
    totalJobLabels: number;
    totalLanes: number;
    rawClicks: number;
    maxRequired: number;
    extraLabels: number;
  } | null => {
    if (!selectedProduct || laneEntries.length === 0) return null;

    const { labelsPerClick, extraClicks, id } = selectedProduct;
    if (labelsPerClick <= 0) return null;

    const totalJobLabels = designsWithEffectiveLanes.reduce((sum, d) => sum + (d.totalLabels > 0 ? d.totalLabels : 0), 0);
    const totalLanes = designsWithEffectiveLanes.reduce((sum, d) => sum + d.effectiveLanes, 0);

    let totalClicks: number;
    let rawClicks = 0;
    let maxRequired = 0;
    let extraLabels = 0;

    if (id === 'p196x48') {
      // Special calculation for Penta-Petit
      extraLabels = labelsPerClick * extraClicks;
      maxRequired = laneEntries.reduce((max, e) => Math.max(max, e.required), 0);
      totalClicks = Math.ceil((maxRequired + extraLabels) / labelsPerClick);
    } else {
      // Standard calculation
      rawClicks = totalJobLabels / labelsPerClick + extraClicks;
      totalClicks = roundUpToNext10(rawClicks);
    }

    const rows: ResultRow[] = laneEntries.map((entry) => {
      let labelsPerClickPerLane: number;
      let produced: number;

      if (id === 'p196x48') {
        labelsPerClickPerLane = labelsPerClick;
        produced = totalClicks * labelsPerClick;
      } else {
        labelsPerClickPerLane = labelsPerClick / totalLanes;
        produced = Math.round(totalClicks * labelsPerClickPerLane);
      }

      return {
        lane: entry.laneIndex,
        designName: entry.designName,
        required: entry.required,
        labelsPerClick: labelsPerClickPerLane,
        totalClicks,
        produced,
        waste: produced - entry.required,
      };
    });

    return { totalClicks, rows, totalJobLabels, totalLanes, rawClicks, maxRequired, extraLabels };
  }, [selectedProduct, laneEntries, designsWithEffectiveLanes]);

  const handleProductChange = (id: string) => {
    setSelectedProductId(id);
    setDesigns([{ id: generateId(), name: 'Design 1', totalLabels: 0, lanes: 0 }]);
  };

  const addDesign = () => {
    if (!selectedProduct) return;
    const usedLanes = designsWithEffectiveLanes.reduce((sum, d) => sum + d.effectiveLanes, 0);
    if (usedLanes >= selectedProduct.maxLanes) {
      alert(`All ${selectedProduct.maxLanes} lanes are already used.`);
      return;
    }
    setDesigns((prev) => [
      ...prev,
      { id: generateId(), name: `Design ${prev.length + 1}`, totalLabels: 0, lanes: 0 },
    ]);
  };

  const removeDesign = (id: string) => {
    if (designs.length <= 1) {
      alert('At least one design row must remain.');
      return;
    }
    setDesigns((prev) => prev.filter((d) => d.id !== id));
  };

  const updateDesign = (id: string, field: keyof DesignRow, value: number) => {
    setDesigns((prev) =>
      prev.map((d) => (d.id === id ? { ...d, [field]: value } : d))
    );
  };

  const setMaxLanes = (id: string) => {
    if (!selectedProduct) return;
    const idx = designs.findIndex((d) => d.id === id);
    const usedBefore = designsWithEffectiveLanes.slice(0, idx).reduce((sum, d) => sum + d.effectiveLanes, 0);
    const available = selectedProduct.maxLanes - usedBefore;
    updateDesign(id, 'lanes', available);
  };

  return (
    <div className="tab-panel active">
      {/* Quick Guide Toggle */}
      <div className="sub-header">
        <button className="help-toggle" onClick={() => setShowGuide(!showGuide)}>
          <span className="help-toggle-icon">?</span>
          <span>Quick guide</span>
        </button>
        <button onClick={() => setShowProductManager(true)}>⚙️ Manage Products</button>
      </div>

      {showGuide && (
        <div className="summary-box help-panel visible">
          <strong>Quick guide – how to use this calculator</strong>
          <ul>
            <li><strong>1.</strong> Choose the correct <em>product size</em> in the dropdown.</li>
            <li><strong>2.</strong> For each design, enter <em>Total labels</em> and number of <em>Lanes</em>.</li>
            <li><strong>3.</strong> The sum of lanes cannot exceed the product's <em>max lanes</em>.</li>
            <li><strong>4.</strong> Use <em>"+ Add design"</em> to add more rows.</li>
            <li><strong>5.</strong> Check the <em>Result</em> section for clicks, produced labels and waste.</li>
          </ul>
        </div>
      )}

      {/* Product Selection */}
      <section className="section">
        <div className="section-header">
          <div className="section-step">1</div>
          <div className="section-title">Product size</div>
        </div>
        <div className="product-size">
          <div className="product-picker">
            <label>
              Product
              <select value={selectedProductId} onChange={(e) => handleProductChange(e.target.value)}>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} {p.isCustom ? '(custom)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <span className="pill-highlight">Change product resets designs</span>
          </div>

          {selectedProduct && (
            <div className="product-summary">
              <div className="summary-title">{selectedProduct.label}</div>
              <div className="summary-grid">
                <div className="summary-item">
                  <span>Max lanes</span>
                  <strong>{selectedProduct.maxLanes}</strong>
                </div>
                <div className="summary-item">
                  <span>Labels / click</span>
                  <strong>{selectedProduct.labelsPerClick}</strong>
                </div>
                <div className="summary-item">
                  <span>Extra clicks</span>
                  <strong>{selectedProduct.extraClicks}</strong>
                </div>
                <div className="summary-item">
                  <span>Type</span>
                  <strong>{selectedProduct.isCustom ? 'Custom' : 'Standard'}</strong>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Designs & Lanes */}
      <section className="section">
        <div className="section-header">
          <div className="section-step">2</div>
          <div className="section-title">Designs & lanes</div>
        </div>
        <div className="designs-lanes">
          <div className="designs-header">
            <div className="designs-header-left">
              <button onClick={addDesign}>+ Add design</button>
            </div>
            <div className="lane-meta">
              <span className="lane-chip">Max lanes: {maxLanes || '—'}</span>
              <span className="lane-chip">Used: {usedLanes}</span>
              <span className="lane-chip">Remaining: {remainingLanes}</span>
            </div>
          </div>

          <div className="lane-meter">
            <div className="lane-meter-track">
              <div className="lane-meter-fill" style={{ width: `${laneUsagePercent}%` }} />
            </div>
            <div className="lane-meter-labels">
              <span>Lane usage</span>
              <span>{maxLanes ? `${usedLanes}/${maxLanes}` : '—'}</span>
            </div>
          </div>
        </div>

        <div className="designs-list">
          {designs.map((design, idx) => (
            <div key={design.id} className="design-row-card">
              <div className="design-cell design-name">
                <div className="design-label">Design</div>
                <div className="design-value">{design.name}</div>
              </div>
              <div className="design-cell">
                <label className="design-input">
                  <span>Total labels</span>
                  <input
                    type="number"
                    className="number-input"
                    min="0"
                    value={design.totalLabels || ''}
                    onChange={(e) => updateDesign(design.id, 'totalLabels', Number(e.target.value) || 0)}
                  />
                </label>
              </div>
              <div className="design-cell">
                <label className="design-input">
                  <span>Lanes for this design</span>
                  <input
                    type="number"
                    className="number-input"
                    min="0"
                    max={selectedProduct?.maxLanes}
                    value={designsWithEffectiveLanes[idx]?.effectiveLanes || ''}
                    onChange={(e) => updateDesign(design.id, 'lanes', Number(e.target.value) || 0)}
                  />
                </label>
              </div>
              <div className="design-cell design-actions">
                <button className="btn-secondary" onClick={() => setMaxLanes(design.id)}>Max</button>
                <button className="btn-danger" onClick={() => removeDesign(design.id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>

        {lanesClamped && selectedProduct && (
          <div className="error-text">
            Total lanes have been limited to max {selectedProduct.maxLanes} for this product.
          </div>
        )}
      </section>

      {/* Results */}
      <section className="section">
        <div className="section-header">
          <div className="section-step">3</div>
          <div className="section-title">Result (distribution & print count)</div>
        </div>

        <div className="results-grid">
          <div className="summary-box">
            {!results ? (
              <span className="muted">Enter total labels and lanes for at least one design to see the calculation.</span>
            ) : selectedProduct?.id === 'p196x48' ? (
              <>
                Total lanes in this job: <strong>{results.totalLanes}</strong><br />
                Max need on any lane: <strong>{formatNumber(results.maxRequired)}</strong> labels<br />
                Extra labels buffer: <strong>{formatNumber(results.extraLabels)}</strong><br />
                <span style={{ fontSize: '15px' }}>
                  <strong style={{ color: 'var(--accent)' }}>Total clicks to print:</strong>{' '}
                  <strong style={{ color: '#f97373' }}>{formatNumber(results.totalClicks)}</strong>
                </span>
              </>
            ) : (
              <>
                Total job labels: <strong>{formatNumber(results.totalJobLabels)}</strong><br />
                Labels per click (all lanes): <strong>{selectedProduct?.labelsPerClick}</strong><br />
                Raw clicks (incl. setup): <strong>{results.rawClicks.toFixed(1)}</strong><br />
                <span style={{ fontSize: '15px' }}>
                  <strong style={{ color: 'var(--accent)' }}>Total clicks to print (rounded up to next 10):</strong>{' '}
                  <strong style={{ color: '#f97373' }}>{formatNumber(results.totalClicks)}</strong>
                </span>
              </>
            )}
          </div>

          {results && results.rows.length > 0 && (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Lane</th>
                    <th>Design</th>
                    <th className="right">Needed per lane</th>
                    <th className="right">Labels per click</th>
                    <th className="right">Total clicks</th>
                    <th className="right">Produced labels</th>
                    <th className="right">Waste</th>
                  </tr>
                </thead>
                <tbody>
                  {results.rows.map((row, idx) => (
                    <tr key={idx}>
                      <td>{row.lane}</td>
                      <td>{row.designName}</td>
                      <td className="right">{formatNumber(row.required)}</td>
                      <td className="right">
                        {selectedProduct?.id === 'p196x48'
                          ? formatNumber(row.labelsPerClick)
                          : row.labelsPerClick.toFixed(2)}
                      </td>
                      <td className="right">{formatNumber(row.totalClicks)}</td>
                      <td className="right">{formatNumber(row.produced)}</td>
                      <td className="right">{formatNumber(row.waste)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Product Manager Modal */}
      {showProductManager && (
        <ProductManager
          products={products}
          onClose={() => setShowProductManager(false)}
          onAdd={addProduct}
          onUpdate={updateProduct}
          onDelete={deleteProduct}
          onImport={importProducts}
        />
      )}
    </div>
  );
}
