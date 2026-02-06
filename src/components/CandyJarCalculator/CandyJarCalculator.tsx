import { useState, useMemo } from 'react';
import { formatNumber } from '../../utils';
import { calculateJarResults } from '../../config/jarConfig';

export function CandyJarCalculator() {
  const [productType, setProductType] = useState<'midi' | 'maxi'>('midi');
  const [jarCount, setJarCount] = useState<number>(0);

  const results = useMemo(() => {
    return calculateJarResults(productType, jarCount);
  }, [productType, jarCount]);

  return (
    <div>
      <section className="section">
        <div className="section-header">
          <div className="section-step">1</div>
          <div className="section-title">Midi / Maxi jars</div>
        </div>
        <p className="muted">
          For candy jars on Midi and Maxi. Choose product type and how many jars to
          produce. The result follows your internal planning table (kg, clicks and
          approximate diecut stop).
        </p>

        <div className="controls-row controls-row-left">
          <label>
            Product type
            <select
              value={productType}
              onChange={(e) => setProductType(e.target.value as 'midi' | 'maxi')}
            >
              <option value="midi">Midi Jars</option>
              <option value="maxi">Maxi Jars</option>
            </select>
          </label>

          <label>
            Jars to produce (pcs)
            <input
              type="number"
              min="1"
              value={jarCount || ''}
              onChange={(e) => setJarCount(Number(e.target.value) || 0)}
            />
          </label>
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <div className="section-step">2</div>
          <div className="section-title">Candy jar result</div>
        </div>
        <div className="summary-box">
          {!results ? (
            <span className="muted">
              Enter product type and number of jars to see the calculation.
            </span>
          ) : (
            <>
              Product type:{' '}
              <strong>{productType === 'midi' ? 'Midi' : 'Maxi'}</strong>
              <br />
              Jars to produce: <strong>{formatNumber(jarCount)}</strong>
              <br />
              Approx. weight: <strong>{results.kg.toFixed(1)}</strong> kg
              <br />
              Total clicks: <strong>{formatNumber(results.clicks)}</strong>
              <br />
              Approx. diecut stop: <strong>{results.meters}</strong> m
            </>
          )}
        </div>
      </section>
    </div>
  );
}
