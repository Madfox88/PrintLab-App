import { useState, useMemo } from 'react';
import type { FlowpackDesignRow } from '../../types';
import { formatNumber, generateId, clampLanes } from '../../utils';
import {
  FLOWPACK_CONFIG,
  flowpackInterpolate,
  flowpackFinalize,
} from '../../config/flowpackConfig';

export function FlowpackCalculator() {
  const [designs, setDesigns] = useState<FlowpackDesignRow[]>([
    { id: generateId(), name: 'Design 1', kg: 0, lanes: 0 },
  ]);

  // Calculate effective lanes
  const designsWithEffectiveLanes = useMemo(() => {
    let remaining = FLOWPACK_CONFIG.maxLanesTotal;
    return designs.map((design) => {
      const clamped = clampLanes(design.lanes, remaining);
      remaining -= clamped;
      return { ...design, effectiveLanes: clamped };
    });
  }, [designs]);

  // Check if lanes were clamped
  const lanesClamped = useMemo(() => {
    return designsWithEffectiveLanes.some(
      (d, i) => d.effectiveLanes !== designs[i].lanes && designs[i].lanes > 0
    );
  }, [designs, designsWithEffectiveLanes]);

  // Calculate results
  const results = useMemo(() => {
    const active = designsWithEffectiveLanes.filter(
      (d) => d.kg > 0 && d.effectiveLanes > 0
    );

    if (active.length === 0) return null;

    let mode: string;
    let kgForTable: number;
    let base: { clicks: number; meters: number };

    if (active.length === 1 && active[0].effectiveLanes === 3) {
      // "3 ens FP" mode
      mode = '3 ens FP';
      kgForTable = active[0].kg;
      base = flowpackInterpolate(
        kgForTable,
        FLOWPACK_CONFIG.kgPoints,
        FLOWPACK_CONFIG.clicks3,
        FLOWPACK_CONFIG.meters3
      );
    } else {
      // "1 FP pr lane" mode
      mode = '1 FP pr lane';
      const totalKg = active.reduce((sum, d) => sum + d.kg, 0);
      kgForTable = totalKg / 3;
      base = flowpackInterpolate(
        kgForTable,
        FLOWPACK_CONFIG.kgPoints,
        FLOWPACK_CONFIG.clicks1,
        FLOWPACK_CONFIG.meters1
      );
    }

    const final = flowpackFinalize(base);
    const totalKgAll = active.reduce((sum, d) => sum + d.kg, 0);
    const usedLanes = active.reduce((sum, d) => sum + d.effectiveLanes, 0);

    return {
      mode,
      kgForTable,
      clicks: final.clicks,
      meters: final.meters,
      totalKg: totalKgAll,
      usedLanes,
      active,
    };
  }, [designsWithEffectiveLanes]);

  const usedLanes = useMemo(
    () => designsWithEffectiveLanes.reduce((sum, d) => sum + d.effectiveLanes, 0),
    [designsWithEffectiveLanes]
  );
  const maxLanes = FLOWPACK_CONFIG.maxLanesTotal;
  const remainingLanes = Math.max(maxLanes - usedLanes, 0);
  const laneUsagePercent = maxLanes > 0 ? Math.min((usedLanes / maxLanes) * 100, 100) : 0;

  const addDesign = () => {
    if (usedLanes >= FLOWPACK_CONFIG.maxLanesTotal) {
      alert(
        `All ${FLOWPACK_CONFIG.maxLanesTotal} lanes are already used. Cannot add more designs.`
      );
      return;
    }
    setDesigns((prev) => [
      ...prev,
      { id: generateId(), name: `Design ${prev.length + 1}`, kg: 0, lanes: 0 },
    ]);
  };

  const removeDesign = (id: string) => {
    if (designs.length <= 1) {
      alert('At least one design row must remain.');
      return;
    }
    setDesigns((prev) => prev.filter((d) => d.id !== id));
  };

  const updateDesign = (id: string, field: keyof FlowpackDesignRow, value: number) => {
    setDesigns((prev) =>
      prev.map((d) => (d.id === id ? { ...d, [field]: value } : d))
    );
  };

  const setMaxLanes = (id: string) => {
    const idx = designs.findIndex((d) => d.id === id);
    const usedBefore = designsWithEffectiveLanes
      .slice(0, idx)
      .reduce((sum, d) => sum + d.effectiveLanes, 0);
    const available = FLOWPACK_CONFIG.maxLanesTotal - usedBefore;
    updateDesign(id, 'lanes', available);
  };

  return (
    <div>
      <section className="section">
        <div className="section-header">
          <div className="section-step">1</div>
          <div className="section-title">Candy wrappers & lanes</div>
        </div>
        <p className="muted">
          For flowpack candy wrappers. Add designs, set lanes (max 3 total), and enter
          kilos of candy. The calculator adds <strong>2 kg</strong> per design for
          adjustment of diecut and wrapping machines.
        </p>

        <div className="designs-lanes">
          <div className="designs-header">
            <div className="designs-header-left">
              <button onClick={addDesign}>+ Add flowpack design</button>
            </div>
            <div className="lane-meta">
              <span className="lane-chip">Max lanes: {maxLanes}</span>
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

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ width: '20%' }}>Design</th>
                <th style={{ width: '15%' }}>Kilos of candy</th>
                <th style={{ width: '15%' }}>Lanes</th>
                <th style={{ width: '15%' }}>Clicks to print</th>
                <th style={{ width: '15%' }}>Diecut stop (m)</th>
                <th style={{ width: '20%' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {designs.map((design, idx) => {
                const effective = designsWithEffectiveLanes[idx];
                const isActive = design.kg > 0 && effective.effectiveLanes > 0;
                return (
                  <tr key={design.id}>
                    <td>{design.name}</td>
                    <td>
                      <input
                        type="number"
                        className="number-input"
                        min="0"
                        step="0.1"
                        value={design.kg || ''}
                        onChange={(e) =>
                          updateDesign(design.id, 'kg', Number(e.target.value) || 0)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="number-input"
                        min="0"
                        max={FLOWPACK_CONFIG.maxLanesTotal}
                        value={effective.effectiveLanes || ''}
                        onChange={(e) =>
                          updateDesign(design.id, 'lanes', Number(e.target.value) || 0)
                        }
                      />
                    </td>
                    <td>{isActive && results ? formatNumber(results.clicks) : ''}</td>
                    <td>{isActive && results ? results.meters : ''}</td>
                    <td className="row-actions">
                      <button
                        className="btn-secondary"
                        onClick={() => setMaxLanes(design.id)}
                      >
                        Max
                      </button>
                      <button
                        className="btn-danger"
                        onClick={() => removeDesign(design.id)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {lanesClamped && (
          <div className="error-text">
            Total lanes limited to {FLOWPACK_CONFIG.maxLanesTotal} across all designs.
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-header">
          <div className="section-step">2</div>
          <div className="section-title">Flowpack result</div>
        </div>
        <div className="summary-box">
          {!results ? (
            <span className="muted">
              Enter kilos and lanes for at least one design.
            </span>
          ) : (
            <>
              Total kg entered: <strong>{formatNumber(results.totalKg)}</strong>
              <br />
              Total lanes used:{' '}
              <strong>
                {results.usedLanes} / {FLOWPACK_CONFIG.maxLanesTotal}
              </strong>
              <br />
              <span className="muted">
                Mode: {results.mode} (table kg basis: {formatNumber(results.kgForTable)})
              </span>
              <br />
              <span style={{ fontSize: '15px' }}>
                <strong style={{ color: 'var(--accent)' }}>Total to print:</strong>{' '}
                <strong style={{ color: '#f97373' }}>{formatNumber(results.clicks)}</strong>
              </span>
              <br />
              <span style={{ fontSize: '15px' }}>
                <strong style={{ color: 'var(--accent)' }}>Approx. diecut stop:</strong>{' '}
                <strong style={{ color: '#f97373' }}>{formatNumber(results.meters)} m</strong>
              </span>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
