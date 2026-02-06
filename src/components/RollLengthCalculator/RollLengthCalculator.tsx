import { useMemo, useRef, useState } from 'react';

const DEFAULTS = {
  tMm: 0.110,
  coreOuterCm: 9.7,
  coreWallCm: 1.0,
  rollOuterCm: '',
  coreIsInner: false,
};

const roundTo = (value: number, dp: number) => {
  const factor = Math.pow(10, dp);
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

export function RollLengthCalculator() {
  const [tMm, setTMm] = useState<number>(DEFAULTS.tMm);
  const [coreOuterCm, setCoreOuterCm] = useState<number>(DEFAULTS.coreOuterCm);
  const [coreWallCm, setCoreWallCm] = useState<number>(DEFAULTS.coreWallCm);
  const [rollOuterCm, setRollOuterCm] = useState<string>(DEFAULTS.rollOuterCm);
  const [coreIsInner, setCoreIsInner] = useState<boolean>(DEFAULTS.coreIsInner);
  const [showInfo, setShowInfo] = useState(false);

  const rollOuterRef = useRef<HTMLInputElement | null>(null);

  const parsedRollOuter = rollOuterCm.trim() === '' ? NaN : Number(rollOuterCm);

  const { error, result } = useMemo(() => {
    if (rollOuterCm.trim() === '') {
      return { error: 'Roll outer diameter is required.', result: null };
    }

    const values = [tMm, coreOuterCm, coreWallCm, parsedRollOuter];
    const allValid = values.every((v) => Number.isFinite(v) && v > 0);
    if (!allValid) {
      return { error: 'All numeric inputs must be greater than 0.', result: null };
    }

    const diCm = coreIsInner ? coreOuterCm : coreOuterCm - 2 * coreWallCm;
    if (!Number.isFinite(diCm) || diCm <= 0) {
      return { error: 'Core inner diameter must be greater than 0.', result: null };
    }

    if (parsedRollOuter <= diCm) {
      return { error: 'Roll outer diameter must be greater than the inner diameter.', result: null };
    }

    const doMm = parsedRollOuter * 10;
    const diMm = diCm * 10;
    const lMm = (Math.PI / (4 * tMm)) * (doMm * doMm - diMm * diMm);
    const lM = lMm / 1000;

    if (!Number.isFinite(lM) || lM <= 0) {
      return { error: 'Calculated length is invalid. Check your inputs.', result: null };
    }

    return {
      error: null,
      result: {
        lengthM: roundTo(lM, 1),
        innerCm: roundTo(diCm, 2),
        diCm,
      },
    };
  }, [coreIsInner, coreOuterCm, coreWallCm, parsedRollOuter, rollOuterCm, tMm]);

  const handleReset = () => {
    setTMm(DEFAULTS.tMm);
    setCoreOuterCm(DEFAULTS.coreOuterCm);
    setCoreWallCm(DEFAULTS.coreWallCm);
    setRollOuterCm(DEFAULTS.rollOuterCm);
    setCoreIsInner(DEFAULTS.coreIsInner);
    setShowInfo(false);
    requestAnimationFrame(() => rollOuterRef.current?.focus());
  };

  return (
    <div className="tab-panel active">
      <div className="roll-length-grid">
        <section className="section">
          <div className="section-header">
            <div className="section-step">1</div>
            <div className="section-title">Inputs</div>
          </div>

          <div className="form-grid">
            <label>
              Total material thickness (t, mm)
              <input
                type="number"
                min="0"
                step="0.001"
                value={Number.isFinite(tMm) ? tMm : ''}
                onChange={(e) => setTMm(e.target.value === '' ? NaN : Number(e.target.value))}
              />
            </label>

            <label>
              Core outer diameter (cm)
              <input
                type="number"
                min="0"
                step="0.1"
                value={Number.isFinite(coreOuterCm) ? coreOuterCm : ''}
                onChange={(e) => setCoreOuterCm(e.target.value === '' ? NaN : Number(e.target.value))}
              />
            </label>

            <label>
              <div className="inline-label">
                <span>Core wall thickness (cm)</span>
                <button
                  type="button"
                  className="info-dot"
                  onClick={() => setShowInfo(true)}
                  aria-label="What does this mean?"
                >
                  ?
                </button>
              </div>
              <input
                type="number"
                min="0"
                step="0.1"
                value={Number.isFinite(coreWallCm) ? coreWallCm : ''}
                onChange={(e) => setCoreWallCm(e.target.value === '' ? NaN : Number(e.target.value))}
              />
            </label>

            <label>
              Roll outer diameter (cm) *
              <input
                ref={rollOuterRef}
                type="number"
                min="0"
                step="0.1"
                value={rollOuterCm}
                onChange={(e) => setRollOuterCm(e.target.value)}
              />
            </label>
          </div>

          <div className="form-row" style={{ marginTop: '12px' }}>
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={coreIsInner}
                onChange={(e) => setCoreIsInner(e.target.checked)}
              />
              Core diameter is already the inner (hole) diameter
            </label>
          </div>

          <div className="controls-row" style={{ marginTop: '12px' }}>
            <button type="button" className="btn-secondary" onClick={handleReset}>
              Reset
            </button>
          </div>

          {error && <div className="error-text">{error}</div>}
        </section>

        <section className="section">
          <div className="section-header">
            <div className="section-step">2</div>
            <div className="section-title">Result</div>
          </div>

          <div className="summary-box results-summary">
            <div className="roll-length-value">
              {result ? `${result.lengthM} meters` : '— meters'}
            </div>
            <div className="pill-highlight" style={{ marginTop: '10px' }}>
              Core inner diameter used: {result ? result.innerCm : '—'} cm
            </div>
          </div>

          <div className="warning-box info" style={{ marginTop: '12px' }}>
            Using t = {tMm} mm, Dₒ = {rollOuterCm || '—'} cm, Dᵢ = {result ? result.diCm : '—'} cm
            (converted to mm inside the formula).
          </div>
        </section>
      </div>

      {showInfo && (
        <div className="modal-overlay" onClick={() => setShowInfo(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Core wall thickness</div>
              <button className="modal-close" onClick={() => setShowInfo(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>
                Core wall thickness is the cardboard tube wall on one side. If core outer diameter is
                9.7 cm and wall is 1.0 cm:
              </p>
              <p>
                Dᵢ = 9.7 − 2×1.0 = 7.7 cm
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowInfo(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
