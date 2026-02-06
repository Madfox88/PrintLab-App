import { useState, useMemo } from 'react';
import { calculateCoronaAdvice, type SurfaceCondition } from '../../lib/dc330CoronaAdvisor';
import { calculateDc330Uv } from '../../lib/dc330UvCalculator';

const SUBSTRATES = [
  'CA PP UCO White',
  'CA PP UCO Clear',
  'PP Silver FTC 50',
  'PP BlueGray',
  'Forest PE White FTC 85',
  'Forest PE Clear FTC 85',
  'SYN-BOPP White 20',
  'SYN-BOPP Metallic 20',
  'SYN-BOPP Clear 20',
  'SYN-BOPP Mat Peach 20',
  'SYN-BOPP Mat 20',
];

const COATINGS = [
  'UV Varnish – Standard Gloss',
  'UV Laminating Adhesive – Standard',
  'UV Laminating Adhesive – Heavy / Premium',
];

export function CoronaUvCalculator() {
  const [speedMpm, setSpeedMpm] = useState(15);
  const [substrate, setSubstrate] = useState(SUBSTRATES[0]);
  const [coating, setCoating] = useState(COATINGS[0]);
  const [surfaceCondition, setSurfaceCondition] = useState<SurfaceCondition>('Aged/unknown');

  const uvResults = useMemo(
    () => calculateDc330Uv({ speedMpm, substrate, coating }),
    [speedMpm, substrate, coating]
  );
  const coronaAdvice = useMemo(
    () => calculateCoronaAdvice({ substrate, coating, surfaceCondition }),
    [substrate, coating, surfaceCondition]
  );

  return (
    <div>
      {/* UV Section */}
      <section className="section">
        <div className="section-header">
          <div className="section-step">1</div>
          <div className="section-title">UV settings</div>
        </div>
        <p className="muted">
          Choose substrate, coating, and speed. The calculator suggests starting points for
          <strong> Min UV</strong> and <strong>Gradient</strong> on the DC330 Mini UV unit.
        </p>

        <div className="controls-row controls-row-left">
          <label>
            Substrate
            <select
              value={substrate}
              onChange={(e) => setSubstrate(e.target.value)}
            >
              {SUBSTRATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label>
            Coating
            <select
              value={coating}
              onChange={(e) => setCoating(e.target.value)}
            >
              {COATINGS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label>
            Speed (m/min)
            <input
              type="number"
              min="0"
              max="40"
              step="0.5"
              value={speedMpm}
              onChange={(e) => setSpeedMpm(Number(e.target.value) || 0)}
            />
          </label>
        </div>

        {/* Results */}
        <div className="summary-box" style={{ marginTop: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
            <div>
              <span className="muted">Target UV</span>
              <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--accent)' }}>
                {uvResults.speedZero ? 'N/A' : `${uvResults.targetUVDisplay} W`}
              </div>
            </div>
            <div>
              <span className="muted">Recommended Min UV</span>
              <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--accent)' }}>
                {uvResults.recommendedMinUV} W
              </div>
            </div>
            <div>
              <span className="muted">Recommended Gradient</span>
              <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--accent)' }}>
                {uvResults.recommendedGradient}
              </div>
            </div>
            <div>
              <span className="muted">Predicted UV</span>
              <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--accent)' }}>
                {uvResults.predictedUV} W
              </div>
            </div>
            <div>
              <span className="muted">Heat-limited</span>
              <div style={{ fontSize: '1.2rem', fontWeight: 600, color: uvResults.heatLimited ? 'var(--danger)' : 'var(--success)' }}>
                {uvResults.heatLimited ? 'Yes' : 'No'}
              </div>
            </div>
            {uvResults.recommendedMaxSpeed !== null && (
              <div>
                <span className="muted">Recommended Max Speed</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--accent)' }}>
                  {uvResults.recommendedMaxSpeed} m/min
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Warnings */}
        {uvResults.warnings.length > 0 && (
          <div style={{ marginTop: '12px' }}>
            {uvResults.warnings.map((warning, idx) => (
              <div key={idx} className="warning-box warn">
                {warning}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Corona Advisor */}
      <section className="section">
        <div className="section-header">
          <div className="section-step">2</div>
          <div className="section-title">Corona treatment</div>
        </div>
        <div className="controls-row controls-row-left">
          <label>
            Surface condition
            <select value={surfaceCondition} onChange={(e) => setSurfaceCondition(e.target.value as SurfaceCondition)}>
              <option value="Fresh/clean">Fresh/clean</option>
              <option value="Aged/unknown">Aged/unknown</option>
              <option value="Contamination risk">Contamination risk</option>
            </select>
          </label>
        </div>

        <div className="summary-box" style={{ marginTop: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
            <div>
              <span className="muted">Target dyne</span>
              <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--accent)' }}>
                {coronaAdvice.targetDyne} dyne/cm
              </div>
            </div>
            <div>
              <span className="muted">Corona recommended</span>
              <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--accent)' }}>
                {coronaAdvice.coronaRecommended ? 'Yes' : 'No'}
              </div>
            </div>
            <div>
              <span className="muted">Confidence</span>
              <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--accent)' }}>
                {coronaAdvice.confidence}
              </div>
            </div>
          </div>
        </div>

        <div className="summary-box" style={{ marginTop: '12px' }}>
          <strong>Notes</strong>
          <ul style={{ margin: '8px 0 0 18px', padding: 0 }}>
            {coronaAdvice.notes.map((note, idx) => (
              <li key={idx}>{note}</li>
            ))}
          </ul>
        </div>

        {coronaAdvice.warnings.length > 0 && (
          <div style={{ marginTop: '12px' }}>
            {coronaAdvice.warnings.map((warning, idx) => (
              <div key={idx} className="warning-box warn">
                {warning}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
