"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  calculateLayout,
  calculateSemiRotaryLimits,
  canAutosave,
  cloneSeed,
  exportPurchaseCsv,
  exportState,
  FIXED_CUTTING_PLATE_MARGIN_MM,
  formatDanishPurchaseText,
  formatMm,
  formatPurchaseText,
  generatePurchaseSpecification,
  getPurchaseExportPolicy,
  hydrateState,
  importState,
  parseLocalizedNumber,
  purchaseCertificateFields,
  resetSavedState,
  saveState,
  finisherProfile as fallbackFinisher,
  pressProfile as fallbackPress,
  sampleDie as fallbackDie,
} from "../src/die-cut-engine";
import type {
  DiePurchaseSpecification,
  DieSpecification,
  FinisherProfile,
  HydrationStatus,
  PressProfile,
  RecoveryState,
  SavedState,
  VerificationState,
} from "../src/die-cut-engine";
import type { DieCutTabCallbacks, DieCutTabInput } from "../src/integration/die-cut-tab-contract";

type Tab = "calculator" | "library" | "machines" | "purchase";
type Layers = { machine: boolean; plate: boolean; margins: boolean; labels: boolean; measurements: boolean };
type CalculatorMode = "simple" | "advanced";

function NumberField({ label, value, onChange, min, step = "0.1", unit = "mm", integer = false, help }: { label: string; value: number | undefined; onChange: (value: number) => void; min?: number; step?: string; unit?: string; integer?: boolean; help?: string }) {
  const [draft, setDraft] = useState(value === undefined ? "" : String(value));
  const [focused, setFocused] = useState(false);
  const commit = () => { const parsed = parseLocalizedNumber(draft); if (Number.isFinite(parsed)) onChange(integer ? Math.trunc(parsed) : parsed); };
  return <label className="field">
    <span>{label}{help && <small title={help}>?</small>}</span>
    <span className="input-unit"><input aria-label={label} inputMode="decimal" value={focused ? draft : value === undefined ? "" : String(value)} min={min} step={step} onFocus={() => { setDraft(value === undefined ? "" : String(value)); setFocused(true); }} onChange={(e) => setDraft(e.target.value)} onBlur={() => { commit(); setFocused(false); }} onKeyDown={(e) => { if (e.key === "Enter") commit(); }} onWheel={(e) => e.currentTarget.blur()} /><b>{unit}</b></span>
  </label>;
}

function OptionalNumberField({ label, value, onChange, min = 0, unit = "mm", help }: { label: string; value: number | undefined; onChange: (value: number | undefined) => void; min?: number; unit?: string; help?: string }) {
  const [draft, setDraft] = useState(value === undefined ? "" : String(value));
  const [focused, setFocused] = useState(false);
  const commit = () => { if (draft.trim() === "") { onChange(undefined); return; } const parsed = parseLocalizedNumber(draft); if (Number.isFinite(parsed)) onChange(parsed); };
  return <label className="field">
    <span>{label}{help && <small title={help}>?</small>}</span>
    <span className="input-unit"><input aria-label={label} inputMode="decimal" placeholder="Not configured" value={focused ? draft : value === undefined ? "" : String(value)} min={min} onFocus={() => { setDraft(value === undefined ? "" : String(value)); setFocused(true); }} onChange={(e) => setDraft(e.target.value)} onBlur={() => { commit(); setFocused(false); }} onKeyDown={(e) => { if (e.key === "Enter") commit(); }} onWheel={() => undefined} /><b>{unit}</b></span>
  </label>;
}

function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span><select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>{children}</select></label>;
}

function Section({ id, title, note, children, open = false }: { id?: string; title: string; note?: string; children: React.ReactNode; open?: boolean }) {
  return <details id={id} className="config-section" open={open}><summary><span>{title}</span><span className="summary-note">{note}</span></summary><div className="section-body">{children}</div></details>;
}

function Metric({ label, value, unit, detail, accent = false }: { label: string; value: string | number; unit: string; detail: string; accent?: boolean }) {
  return <article className={accent ? "accent" : undefined}><span>{label}</span><strong>{value} <i>{unit}</i></strong><small>{detail}</small></article>;
}

function TechnicalVisualizer({ die, press, calc, layers, webWidthMm, controls }: { die: DieSpecification; press: PressProfile; calc: ReturnType<typeof calculateLayout>; layers: Layers; webWidthMm?: number; controls?: React.ReactNode }) {
  const topWebMarginMm = 18;
  const bottomWebMarginMm = 18;
  const minimumWebHeightMm = 220;
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const printableWidthMm = press.maxPrintableWidthMm;
  const webWidth = webWidthMm && webWidthMm > 0 ? Math.max(webWidthMm, printableWidthMm) : printableWidthMm;
  const printableOffsetX = Math.max((webWidth - printableWidthMm) / 2, 0);
  const height = Math.max(calc.plateRepeatMm + topWebMarginMm + bottomWebMarginMm, minimumWebHeightMm);
  const padding = 42;
  const viewW = webWidth + padding * 2;
  const viewH = height + padding * 2;
  const labelW = calc.effectiveLabelWidthMm;
  const labelH = calc.effectiveLabelLengthMm;
  const startX = printableOffsetX + calc.leftOffsetMm;
  const plateStartY = topWebMarginMm;
  const labelStartY = plateStartY + calc.leadingPlateMarginMm;
  const plateMargin = FIXED_CUTTING_PLATE_MARGIN_MM;
  const plateMarginX = startX - plateMargin;
  const plateMarginY = labelStartY - plateMargin;
  const plateMarginW = calc.occupiedWidthMm + plateMargin * 2;
  const plateMarginH = calc.occupiedLabelLengthMm + plateMargin * 2;
  return <div className="visualizer-shell">
    <div className="visual-controls-row">
      <div className="layer-menu">{controls}</div>
      <div className="drawing-toolbar" aria-label="Drawing controls">
        <button onClick={() => setZoom((z) => Math.min(z * 1.2, 3))} aria-label="Zoom in">＋</button>
        <button onClick={() => setZoom((z) => Math.max(z / 1.2, .5))} aria-label="Zoom out">−</button>
        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>Fit</button>
        <span>{Math.round(zoom * 100)}%</span>
      </div>
    </div>
    <svg className="die-svg" viewBox={`${-padding} ${-padding} ${viewW} ${viewH}`} role="img" aria-label={`Proportional die layout with ${die.layout.labelsAcross} labels across and ${die.layout.labelsAround} around`}
      onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => { if (drag.current) setPan({ x: drag.current.px + (e.clientX - drag.current.x) / zoom, y: drag.current.py + (e.clientY - drag.current.y) / zoom }); }}
      onPointerUp={() => { drag.current = null; }}>
      <defs>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="currentColor" /></marker>
        <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" fill="none" stroke="#dbe4e7" strokeWidth=".35" /></pattern>
      </defs>
      <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
        <rect x="0" y="0" width={webWidth} height={height} fill="#f8fbfb" />
        <rect x="0" y="0" width={webWidth} height={height} fill="url(#grid)" />
        {webWidth > printableWidthMm && <rect x="0" y="0" width={webWidth} height={height} className="web-boundary" />}
        {layers.machine && <rect x={printableOffsetX} y="0" width={printableWidthMm} height={height} className={`press-boundary ${calc.fitsPressWidth ? "" : "invalid"}`} />}
        {layers.margins && <rect x={plateMarginX} y={plateMarginY} width={plateMarginW} height={plateMarginH} className="plate-margin-zone" />}
        {layers.plate && <rect x={startX} y={plateStartY} width={calc.occupiedWidthMm} height={calc.plateRepeatMm} className="plate-boundary" />}
        {layers.labels && Array.from({ length: Math.max(0, die.layout.labelsAround) }).flatMap((_, row) => Array.from({ length: Math.max(0, die.layout.labelsAcross) }).map((__, col) => {
          const x = startX + col * (labelW + die.layout.gapAcrossMm);
          const y = labelStartY + row * (labelH + die.layout.gapAroundMm);
          const className = `cut-path ${calc.errors.length ? "invalid" : ""}`;
          if (die.label.shape === "circle") return <circle key={`${row}-${col}`} cx={x + labelW / 2} cy={y + labelH / 2} r={labelW / 2} className={className} />;
          if (die.label.shape === "ellipse") return <ellipse key={`${row}-${col}`} cx={x + labelW / 2} cy={y + labelH / 2} rx={labelW / 2} ry={labelH / 2} className={className} />;
          return <rect key={`${row}-${col}`} x={x} y={y} width={labelW} height={labelH} rx={die.label.shape === "roundedRectangle" ? die.label.cornerRadiusMm : 0} className={className} />;
        }))}
        {layers.measurements && <>
          <g className="dimension"><line x1={printableOffsetX} y1="-12" x2={printableOffsetX + printableWidthMm} y2="-12" markerStart="url(#arrow)" markerEnd="url(#arrow)" /><text x={printableOffsetX + printableWidthMm / 2} y="-17">Printable width {formatMm(printableWidthMm)}</text></g>
          {webWidth > printableWidthMm && <g className="dimension"><line x1="0" y1="-24" x2={webWidth} y2="-24" markerStart="url(#arrow)" markerEnd="url(#arrow)" /><text x={webWidth / 2} y="-29">Web width {formatMm(webWidth)}</text></g>}
          <g className="dimension"><line x1={startX} y1={height + 12} x2={startX + calc.occupiedWidthMm} y2={height + 12} markerStart="url(#arrow)" markerEnd="url(#arrow)" /><text x={startX + calc.occupiedWidthMm / 2} y={height + 27}>Occupied {formatMm(calc.occupiedWidthMm)}</text></g>
          <text x={startX + labelW / 2} y={labelStartY + labelH / 2} className="label-measure" transform={`rotate(-90 ${startX + labelW / 2} ${labelStartY + labelH / 2})`}>{formatMm(labelW)} × {formatMm(labelH)}</text>
        </>}
        <g className="web-arrow" transform={`translate(${webWidth + 18} ${height / 2 - 35})`}><line x1="0" y1="0" x2="0" y2="60" markerEnd="url(#arrow)" /><text transform="rotate(90 9 30)" x="9" y="30">WEB DIRECTION</text></g>
      </g>
    </svg>
    <div className="legend"><span><i className="blue" />Printable area</span><span><i className="purple" />Cutting repeat</span><span><i className="amber" />Margin edge (10 mm from cut path)</span><span><i className="black" />Cut path</span></div>
  </div>;
}

function download(filename: string, text: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}

function RecoveryScreen({ recovery, onRetry, onSample, onReset }: { recovery: RecoveryState; onRetry: () => void; onSample: () => void; onReset: () => void }) {
  const [showErrors, setShowErrors] = useState(false);
  const errors = [recovery.parseError, ...recovery.validationErrors].filter((value): value is string => Boolean(value));
  return <main className="recovery-page"><section className="recovery-card" role="alert"><span className="eyebrow">LOCAL DATA RECOVERY</span><h1>Saved data could not be loaded</h1><p>Your original browser data has been preserved and has not been overwritten.</p><div className="button-row recovery-actions"><button className="secondary" onClick={() => navigator.clipboard.writeText(recovery.rawPayload)}>Copy raw saved JSON</button><button className="secondary" onClick={() => download(`digital-die-designer-recovery-${recovery.detectedAtIso.split(":").join("-")}.json`, recovery.rawPayload)}>Download raw saved JSON</button><button className="secondary" onClick={() => setShowErrors((current) => !current)}>{showErrors ? "Hide" : "View"} validation errors</button></div>{showErrors && <ul className="recovery-errors">{errors.map((error) => <li key={error}>{error}</li>)}</ul>}<div className="recovery-next"><button className="secondary" onClick={onRetry}>Retry after manual correction</button><button className="secondary" onClick={onSample}>Start with a sample die</button><button className="danger-button" onClick={onReset}>Reset local saved data</button></div><small>Starting with the sample will keep persistence locked until you explicitly choose Save changes.</small></section></main>;
}

const applyTabInput = (base: SavedState, input?: DieCutTabInput): SavedState => {
  if (!input) return base;
  if (input.initialState) return structuredClone(input.initialState);
  const next = structuredClone(base);
  if (input.pressProfiles && input.pressProfiles.length > 0) next.pressProfiles = structuredClone(input.pressProfiles);
  if (input.finisherProfiles && input.finisherProfiles.length > 0) next.finisherProfiles = structuredClone(input.finisherProfiles);
  if (input.initialDie) {
    next.dieSpecifications = [structuredClone(input.initialDie)];
    next.activeDieId = input.initialDie.id;
  }
  return next;
};

export interface DigitalDieDesignerProps {
  input?: DieCutTabInput;
  callbacks?: DieCutTabCallbacks;
}

export default function DigitalDieDesigner({ input, callbacks }: DigitalDieDesignerProps = {}) {
  const hasExternalInput = Boolean(input?.initialState || input?.initialDie || input?.pressProfiles || input?.finisherProfiles);
  const [state, setState] = useState<SavedState>(() => applyTabInput(cloneSeed(), input));
  const [hydrationStatus, setHydrationStatus] = useState<HydrationStatus>("loading");
  const [recovery, setRecovery] = useState<RecoveryState | null>(null);
  const [persistenceLocked, setPersistenceLocked] = useState(false);
  const [tab, setTab] = useState<Tab>("calculator");
  const [calculatorMode, setCalculatorMode] = useState<CalculatorMode>("simple");
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState("");
  const [layers, setLayers] = useState<Layers>({ machine: true, plate: true, margins: true, labels: true, measurements: true });
  const importRef = useRef<HTMLInputElement>(null);

  const performHydration = useCallback(() => {
    if (hasExternalInput) {
      setState(applyTabInput(cloneSeed(), input));
      setRecovery(null);
      setPersistenceLocked(false);
      setHydrationStatus("valid");
      return;
    }
    const result = hydrateState();
    if (result.status === "recoveryRequired") {
      setRecovery(result.recovery);
      setHydrationStatus("recoveryRequired");
      return;
    }
    setState(result.state);
    setRecovery(null);
    setPersistenceLocked(false);
    setHydrationStatus(result.status);
  }, [hasExternalInput, input]);
  useEffect(() => { const timer = window.setTimeout(performHydration, 0); return () => window.clearTimeout(timer); }, [performHydration]);
  useEffect(() => {
    if (hasExternalInput) return;
    if (canAutosave(hydrationStatus, persistenceLocked)) saveState(state);
  }, [state, hydrationStatus, persistenceLocked, hasExternalInput]);
  useEffect(() => { const guard = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); }; window.addEventListener("beforeunload", guard); return () => window.removeEventListener("beforeunload", guard); }, [dirty]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 2600); return () => window.clearTimeout(timer); }, [toast]);

  const active = state.dieSpecifications.find((die) => die.id === state.activeDieId) ?? state.dieSpecifications[0] ?? fallbackDie;
  const press = state.pressProfiles.find((item) => item.id === active.pressProfileId) ?? state.pressProfiles[0] ?? fallbackPress;
  const finisher = state.finisherProfiles.find((item) => item.id === active.finisherProfileId) ?? state.finisherProfiles[0] ?? fallbackFinisher;
  const simplifiedFinisher = useMemo(() => ({
    ...finisher,
    physicalWebCheckRequiredForOrdering: false,
    registrationMarkCheckRequiredForReview: false,
    sensorCheckRequiredForReview: false,
    tolerancesCheckRequiredForReview: false,
    dielineReferenceRequiredForReview: false,
    supplierNotesRequiredForReview: false,
    operatorReviewRequiredForReview: false,
  }), [finisher]);
  const effectiveDie = useMemo(() => {
    if (calculatorMode === "advanced") return active;
    return {
      ...active,
      plateMarginsVerification: "notRequired" as VerificationState,
      registrationRequirementsVerification: "notRequired" as VerificationState,
      sensorRequirementsVerification: "notRequired" as VerificationState,
      physicalWebVerification: "notRequired" as VerificationState,
      tolerancesVerification: "notRequired" as VerificationState,
      operatorReviewVerification: "notRequired" as VerificationState,
    };
  }, [active, calculatorMode]);
  const effectiveFinisher = calculatorMode === "simple" ? simplifiedFinisher : finisher;
  const cylinder = effectiveFinisher.cylinders.find((item) => item.id === effectiveDie.cylinderProfileId);
  const calc = useMemo(() => calculateLayout(effectiveDie, press, effectiveFinisher), [effectiveDie, press, effectiveFinisher]);
  const purchase = useMemo(() => generatePurchaseSpecification(effectiveDie, calc, press, effectiveFinisher, cylinder), [effectiveDie, calc, press, effectiveFinisher, cylinder]);
  const purchaseCsvPayload = useMemo(() => exportPurchaseCsv(purchase), [purchase]);
  const purchaseJsonPayload = useMemo(() => JSON.stringify({ documentStatus: getPurchaseExportPolicy(purchase).documentLabel, ...purchaseCertificateFields(purchase) }, null, 2), [purchase]);
  const previewWebWidthMm = active.webWidthMm ?? finisher.maxWebWidthMm;
  const purchasePolicy = useMemo(() => getPurchaseExportPolicy(purchase), [purchase]);
  const incompleteRequiredCount = purchase.checklist.filter((entry) => entry.required && !entry.complete).length;
  const setApplicationState: React.Dispatch<React.SetStateAction<SavedState>> = (action) => { if (hydrationStatus === "empty" && !persistenceLocked) setHydrationStatus("valid"); setState(action); };
  const updateDie = (producer: (die: DieSpecification) => DieSpecification) => { setApplicationState((current) => ({ ...current, dieSpecifications: current.dieSpecifications.map((die) => die.id === current.activeDieId ? producer({ ...die, updatedAt: new Date().toISOString() }) : die) })); setDirty(true); };
  const patchLabel = (patch: Partial<DieSpecification["label"]>) => updateDie((die) => ({ ...die, label: { ...die.label, ...patch } }));
  const patchLayout = (patch: Partial<DieSpecification["layout"]>) => updateDie((die) => ({ ...die, layout: { ...die.layout, ...patch } }));
  const patchCertificate = (patch: Partial<DieSpecification["certificate"]>) => updateDie((die) => ({ ...die, certificate: { ...die.certificate, ...patch } }));
  useEffect(() => {
    callbacks?.onChange?.({
      activeDie: effectiveDie,
      calculation: calc,
      purchaseSpecification: purchase,
      plainTextSupplierCopy: formatDanishPurchaseText(purchase),
      dirty,
      blocked: purchasePolicy.blocked,
    });
  }, [callbacks?.onChange, effectiveDie, calc, purchase, dirty, purchasePolicy.blocked]);

  const save = () => {
    if (!hasExternalInput && persistenceLocked && !window.confirm("Replace the preserved invalid local data with the current sample state?")) return;
    if (!hasExternalInput) {
      saveState(state);
      setPersistenceLocked(false);
      setHydrationStatus("valid");
    }
    callbacks?.onSave?.(state);
    callbacks?.onExport?.({ state, purchaseJson: purchaseJsonPayload, purchaseCsv: purchaseCsvPayload });
    setDirty(false);
    setToast("Die saved on this device");
  };

  const purchaseBlocked = purchasePolicy.blocked;
  if (hydrationStatus === "loading") return <main className="recovery-page"><section className="recovery-card" aria-live="polite"><h1>Loading saved die data…</h1></section></main>;
  if (hydrationStatus === "recoveryRequired" && recovery) return <RecoveryScreen recovery={recovery} onRetry={performHydration} onSample={() => { setState(cloneSeed()); setRecovery(null); setPersistenceLocked(true); setHydrationStatus("empty"); setDirty(true); }} onReset={() => { if (!window.confirm("Permanently remove the unreadable local data and start with the sample die?")) return; resetSavedState(); setState(cloneSeed()); setRecovery(null); setPersistenceLocked(false); setHydrationStatus("empty"); setDirty(false); }} />;

  return <main className="die-cut-calculator-shell">
    <header className="topbar">
      <div className="brand-copy"><h1>Digital Die Designer</h1></div>
      <nav aria-label="Main navigation">{(["calculator","library","machines","purchase"] as Tab[]).map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item === "purchase" ? "Purchase spec" : item}</button>)}</nav>
      <div className="header-actions"><button className="secondary" disabled={tab === "purchase" && purchaseBlocked} title={tab === "purchase" && purchaseBlocked ? "Resolve blocking purchase issues before printing" : undefined} onClick={() => window.print()}>Print summary</button><button className="primary" onClick={save}>{dirty ? "Save changes" : "Saved ✓"}</button></div>
    </header>

    {tab === "calculator" && <div className="workspace-grid">
      <aside className="config-panel" aria-label="Configuration">
        <div className="config-mode-bar"><span>Mode</span><div className="segmented"><button className={calculatorMode === "simple" ? "active" : ""} onClick={() => setCalculatorMode("simple")}>Simple</button><button className={calculatorMode === "advanced" ? "active" : ""} onClick={() => setCalculatorMode("advanced")}>Advanced</button></div></div>
        <Section title="Machine selection" note="Defaults" open>
          <SelectField label="Press" value={active.pressProfileId} onChange={(value) => updateDie((die) => ({ ...die, pressProfileId: value }))}>{state.pressProfiles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectField>
          <SelectField label="Finisher" value={active.finisherProfileId} onChange={(value) => updateDie((die) => ({ ...die, finisherProfileId: value }))}>{state.finisherProfiles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectField>
        </Section>
        <Section title="Semi-rotary cylinder" note={cylinder?.certified ? "Digital mode" : "Verify"} open>
          <SelectField label="Magnetic cylinder" value={active.cylinderProfileId ?? ""} onChange={(value) => updateDie((die) => ({ ...die, cylinderProfileId: value, dieCutMode: "semiRotary" }))}><option value="">Select cylinder</option>{finisher.cylinders.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.certifiedCircumferenceMm} mm</option>)}</SelectField>
          <div className="cert-card"><span>{cylinder?.teeth ?? "—"} teeth</span><strong>{cylinder?.certifiedCircumferenceMm.toFixed(1) ?? "—"} mm</strong><small>Certified circumference · recommended plate range {cylinder ? `${cylinder.recommendedMinPlateLengthMm.toFixed(1)}–${cylinder.recommendedMaxPlateLengthMm.toFixed(1)} mm` : "not configured"}</small></div>
        </Section>
        <Section title="Label geometry" note={`${active.label.widthMm} × ${active.label.lengthMm} mm`} open>
          <SelectField label="Shape" value={active.label.shape} onChange={(value) => { const shape = value as DieSpecification["label"]["shape"]; patchLabel({ shape, lengthMm: shape === "circle" ? active.label.widthMm : active.label.lengthMm, cornerRadiusMm: shape === "circle" ? active.label.widthMm / 2 : shape === "roundedRectangle" ? active.label.cornerRadiusMm : 0 }); }}><option value="rectangle">Rectangle</option><option value="roundedRectangle">Rounded rectangle</option><option value="circle">Circle</option><option value="ellipse">Ellipse</option></SelectField>
          {active.label.shape === "circle" ? <NumberField label="Diameter" value={active.label.widthMm} min={0} onChange={(value) => patchLabel({ widthMm: value, lengthMm: value, cornerRadiusMm: value / 2 })} /> : <div className="field-grid"><NumberField label="Width · across" value={active.label.widthMm} min={0} onChange={(value) => patchLabel({ widthMm: value })} /><NumberField label="Length · around" value={active.label.lengthMm} min={0} onChange={(value) => patchLabel({ lengthMm: value })} /></div>}
          <div className="field-grid">{active.label.shape === "roundedRectangle" ? <NumberField label="Corner radius" value={active.label.cornerRadiusMm} min={0} onChange={(value) => patchLabel({ cornerRadiusMm: value })} /> : <div className="derived-field"><span>{active.label.shape === "circle" ? "Radius" : "Corner radius"}</span><strong>{active.label.shape === "circle" ? `${(active.label.widthMm / 2).toFixed(1)} mm` : "Not applicable"}</strong></div>}<SelectField label="Orientation" value={String(active.label.rotationDegrees)} onChange={(value) => patchLabel({ rotationDegrees: Number(value) as 0 | 90 })}><option value="0">0° Standard</option><option value="90">90° Rotated</option></SelectField></div>
        </Section>
        <Section title="Step & repeat" note={`${active.layout.labelsAcross} × ${active.layout.labelsAround}`} open>
          <div className="field-grid"><NumberField label="Labels across" value={active.layout.labelsAcross} unit="labels" step="1" integer min={1} onChange={(value) => patchLayout({ labelsAcross: value })} /><NumberField label="Labels around · web direction" value={active.layout.labelsAround} unit={calc.maximumLabelsAround === undefined ? "labels" : `/ ${calc.maximumLabelsAround} max`} step="1" integer min={1} onChange={(value) => patchLayout({ labelsAround: value })} /></div>
          <div className="field-grid"><NumberField label="Gap across" value={active.layout.gapAcrossMm} min={0} onChange={(value) => patchLayout({ gapAcrossMm: value })} /><NumberField label="Gap around" value={active.layout.gapAroundMm} min={0} onChange={(value) => patchLayout({ gapAroundMm: value })} /></div>
          <div className="repeat-card"><span>Plate repeat</span><strong>{calc.plateRepeatMm.toFixed(1)} mm</strong><small>{calc.occupiedLabelLengthMm.toFixed(1)} mm occupied labels + {calc.leadingPlateMarginMm.toFixed(1)} mm leading + {calc.trailingPlateMarginMm.toFixed(1)} mm trailing · recommended {calc.recommendedMinimumPlateLengthMm?.toFixed(1) ?? "—"}–{calc.recommendedMaximumPlateLengthMm?.toFixed(1) ?? "—"} mm</small></div>
          <div className="field-grid"><NumberField label="Leading edge to first cut" value={active.leadingPlateMarginMm ?? 0} min={0} onChange={(value) => updateDie((die) => ({ ...die, leadingPlateMarginMm: value, plateMarginsVerification: calculatorMode === "advanced" ? "unknown" : "notRequired" }))} /><NumberField label="Final cut to next repeat" value={active.trailingPlateMarginMm ?? 0} min={0} onChange={(value) => updateDie((die) => ({ ...die, trailingPlateMarginMm: value, plateMarginsVerification: calculatorMode === "advanced" ? "unknown" : "notRequired" }))} /></div>
          <OptionalNumberField label="Registration-mark pitch" value={active.registrationMarkPitchMm} min={0.1} help="When configured, this becomes the authoritative plate repeat and must contain the complete cut geometry." onChange={(value) => updateDie((die) => ({ ...die, registrationMarkPitchMm: value }))} />
          <div className="repeat-card"><span>Cutting plate margin</span><strong>{FIXED_CUTTING_PLATE_MARGIN_MM.toFixed(1)} mm all around</strong><small>Fixed outside the occupied layout: left {FIXED_CUTTING_PLATE_MARGIN_MM.toFixed(1)} mm, right {FIXED_CUTTING_PLATE_MARGIN_MM.toFixed(1)} mm, leading {FIXED_CUTTING_PLATE_MARGIN_MM.toFixed(1)} mm, trailing {FIXED_CUTTING_PLATE_MARGIN_MM.toFixed(1)} mm.</small></div>
        </Section>
        {calculatorMode === "advanced" && <Section title="Advanced production checks" note="Workflow checks">
          <SelectField label="Cut-position spacing status" value={active.plateMarginsVerification} onChange={(value) => updateDie((die) => ({ ...die, plateMarginsVerification: value as VerificationState }))}><option value="unknown">Review required</option><option value="confirmed">Confirmed on machine</option><option value="notRequired">Not required</option></SelectField>
          <SelectField label="Registration-mark requirements" value={active.registrationRequirementsVerification} onChange={(value) => updateDie((die) => ({ ...die, registrationRequirementsVerification: value as VerificationState }))}><option value="unknown">Requires confirmation</option><option value="confirmed">Confirmed</option><option value="notRequired">Not required</option></SelectField>
          <SelectField label="Sensor / eye-mark requirements" value={active.sensorRequirementsVerification} onChange={(value) => updateDie((die) => ({ ...die, sensorRequirementsVerification: value as VerificationState }))}><option value="unknown">Requires confirmation</option><option value="confirmed">Confirmed</option><option value="notRequired">Not required</option></SelectField>
        </Section>}
        <Section title="Material & certificate" note="Documentary" open>
          <div className="field-grid"><label className="field"><span>Mark</span><input value={active.certificate.mark ?? ""} placeholder="e.g. Kombucha" onChange={(e) => patchCertificate({ mark: e.target.value })} /></label><label className="field"><span>Media</span><input value={active.certificate.material ?? ""} placeholder="e.g. PP UCO White" onChange={(e) => patchCertificate({ material: e.target.value })} /></label></div>
          <label className="field"><span>Extra treatment</span><input value={active.certificate.extraTreatment ?? ""} placeholder="e.g. Laser" onChange={(e) => patchCertificate({ extraTreatment: e.target.value })} /></label>
          <label className="field"><span>Die quality</span><input value={active.certificate.dieQuality ?? ""} onChange={(e) => patchCertificate({ dieQuality: e.target.value })} /></label>
          <div className="field-grid"><label className="field"><span>Supplier</span><input value={active.certificate.supplier ?? ""} onChange={(e) => patchCertificate({ supplier: e.target.value })} /></label><label className="field"><span>Tool number</span><input value={active.certificate.supplierToolNumber ?? ""} onChange={(e) => patchCertificate({ supplierToolNumber: e.target.value })} /></label></div>
          <label className="check"><input type="checkbox" checked={active.certificate.perforation} onChange={(e) => patchCertificate({ perforation: e.target.checked })} /> Perforation required</label>
        </Section>
        {calculatorMode === "advanced" && <Section id="physical-web-suitability" title="Physical web suitability" note={active.physicalWebVerification === "confirmed" ? "Confirmed" : active.physicalWebVerification === "notRequired" ? "Not required" : "Verification required"}>
          {!finisher.physicalWebCheckRequiredForOrdering && <div className="not-configured">This check is disabled by the selected finisher profile.</div>}
          <OptionalNumberField label="Physical web width" value={active.webWidthMm} min={0.1} onChange={(value) => updateDie((die) => ({ ...die, webWidthMm: value, physicalWebVerification: "unknown" }))} />
          <div className="field-grid"><OptionalNumberField label="Required left edge margin" value={active.requiredLeftEdgeMarginMm} onChange={(value) => updateDie((die) => ({ ...die, requiredLeftEdgeMarginMm: value, physicalWebVerification: "unknown" }))} /><OptionalNumberField label="Required right edge margin" value={active.requiredRightEdgeMarginMm} onChange={(value) => updateDie((die) => ({ ...die, requiredRightEdgeMarginMm: value, physicalWebVerification: "unknown" }))} /></div>
          <SelectField label="Physical web status" value={finisher.physicalWebCheckRequiredForOrdering ? active.physicalWebVerification : "notRequired"} onChange={(value) => updateDie((die) => ({ ...die, physicalWebVerification: value as VerificationState }))}><option value="unknown">Supplier review required</option><option value="confirmed">Confirmed</option>{!finisher.physicalWebCheckRequiredForOrdering && <option value="notRequired">Not required by profile</option>}</SelectField>
        </Section>}
        {calculatorMode === "advanced" && <Section title="Human review details" note={`${incompleteRequiredCount} required incomplete`}>
          <label className="field"><span>Dieline attachment or reference</span><input value={active.certificate.referenceFile ?? ""} placeholder="Filename, job reference, or shared-path reference" onChange={(e) => patchCertificate({ referenceFile: e.target.value })} /></label>
          <label className="field"><span>Supplier notes</span><textarea value={active.certificate.notes ?? ""} placeholder="Optional manufacturing notes" onChange={(e) => patchCertificate({ notes: e.target.value })} /></label>
          <SelectField label="Tolerance requirements" value={active.tolerancesVerification} onChange={(value) => updateDie((die) => ({ ...die, tolerancesVerification: value as VerificationState }))}><option value="unknown">Not reviewed</option><option value="confirmed">Confirmed</option><option value="notRequired">Not required</option></SelectField>
          <SelectField label="Internal review" value={active.operatorReviewVerification} onChange={(value) => updateDie((die) => ({ ...die, operatorReviewVerification: value as VerificationState }))}><option value="unknown">Operator review pending</option><option value="confirmed">Reviewed by operator</option><option value="notRequired">Not required by workflow</option></SelectField>
        </Section>}
      </aside>

      <section className="visual-panel" aria-label="Technical visualizer">
          <div className="panel-heading"><div><span className="eyebrow">TECHNICAL VIEW</span><h2>Die layout · proportional scale</h2></div></div>
          <TechnicalVisualizer
            die={active}
            press={press}
            calc={calc}
            layers={layers}
            webWidthMm={previewWebWidthMm}
            controls={Object.entries(layers).map(([key, shown]) => <label key={key}><input type="checkbox" checked={shown} onChange={(e) => setLayers((current) => ({ ...current, [key]: e.target.checked }))} />{key}</label>)}
          />
        <div className="visual-footer"><span><b>Across web</b> {formatMm(calc.occupiedWidthMm)}</span><span><b>Plate repeat</b> {formatMm(calc.plateRepeatMm)}</span><span><b>Web width</b> {previewWebWidthMm ? formatMm(previewWebWidthMm) : "Not configured"}</span><span><b>Recommended maximum</b> {calc.recommendedMaximumPlateLengthMm ? formatMm(calc.recommendedMaximumPlateLengthMm) : "Not configured"}</span></div>
      </section>

      <aside className="results-panel" aria-label="Calculation results">
        <div className={`fit-banner pill ${calc.status}`} aria-live="polite" aria-atomic="true" aria-label={`Die Cut Status ${calc.status}`}><span>Die Cut Status</span></div>
        <div className="metric-grid"><Metric label="Occupied width" value={calc.occupiedWidthMm.toFixed(1)} unit="mm" detail="across web" /><Metric label="Width remaining" value={calc.widthRemainingMm.toFixed(1)} unit="mm" detail="printable area" accent /><Metric label="Registration-mark pitch" value={calc.plateRepeatMm.toFixed(1)} unit="mm" detail="complete cutting repeat" /><Metric label="Recommended allowance" value={calc.plateRepeatRemainingMm?.toFixed(1) ?? "—"} unit="mm" detail={`remaining to ${calc.recommendedMaximumPlateLengthMm?.toFixed(1) ?? "—"} mm`} /><Metric label="Recommended-limit utilization" value={calc.plateLengthUtilizationPercent?.toFixed(2) ?? "—"} unit="%" detail="registration pitch ÷ recommended maximum" /><Metric label="Labels around" value={`${active.layout.labelsAround} / ${calc.maximumLabelsAround ?? "—"}`} unit="labels" detail="entered / maximum" /><Metric label="Cylinder circumference" value={cylinder?.certifiedCircumferenceMm.toFixed(1) ?? "—"} unit="mm" detail="certified" /><Metric label="Reserved motion zone" value={calc.reservedSemiRotaryMotionZoneMm?.toFixed(1) ?? "—"} unit="mm" detail="not label-layout space" /><Metric label="Side clearance" value={calc.leftOffsetMm.toFixed(1)} unit="mm" detail="visual centering" /><Metric label="Labels per repeat" value={calc.totalLabelsPerRepeat} unit="labels" detail={`${active.layout.labelsAcross} × ${active.layout.labelsAround}`} /></div>
        <div className="utilization"><div><span>Printable width utilization</span><b>{calc.pressWidthUtilizationPercent.toFixed(2)}%</b></div><progress max="100" value={Math.min(calc.pressWidthUtilizationPercent, 100)} /><small>{calc.occupiedWidthMm.toFixed(1)} of {press.maxPrintableWidthMm.toFixed(1)} mm</small></div>
        <section className="message-stack"><h3>Production checks <span>{calc.errors.length + calc.warnings.length}</span></h3>{[...calc.errors, ...calc.warnings].map((message) => <article key={message.id} className={message.level}><b>{message.level === "error" ? "×" : "!"}</b><div><strong>{message.title}</strong><p>{message.detail}</p>{message.actionLabel && message.relatedFieldId && <button type="button" onClick={() => { const target = document.getElementById(message.relatedFieldId!); if (target instanceof HTMLDetailsElement) target.open = true; target?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>{message.actionLabel}</button>}</div></article>)}</section>
        {calculatorMode === "advanced" && <Section title="Calculation explanation" note="Visible formulas" open><div className="formula-panel"><div><span>Occupied width</span><code>= {active.layout.labelsAcross} × {calc.effectiveLabelWidthMm.toFixed(1)} + {Math.max(active.layout.labelsAcross - 1, 0)} × {active.layout.gapAcrossMm.toFixed(1)}<br />= <strong>{calc.occupiedWidthMm.toFixed(1)} mm</strong></code></div><div><span>Remaining width</span><code>= {press.maxPrintableWidthMm.toFixed(1)} − {calc.occupiedWidthMm.toFixed(1)}<br />= <strong>{calc.widthRemainingMm.toFixed(1)} mm</strong></code></div><div><span>Centered clearance</span><code>= {calc.widthRemainingMm.toFixed(1)} ÷ 2<br />= <strong>{calc.leftOffsetMm.toFixed(1)} mm per side</strong></code></div><div><span>Occupied label length</span><code>= {active.layout.labelsAround} × {calc.effectiveLabelLengthMm.toFixed(1)} + {Math.max(active.layout.labelsAround - 1, 0)} × {active.layout.gapAroundMm.toFixed(1)}<br />= <strong>{calc.occupiedLabelLengthMm.toFixed(1)} mm</strong></code></div><div><span>Plate repeat</span><code>= {calc.leadingPlateMarginMm.toFixed(1)} + {calc.occupiedLabelLengthMm.toFixed(1)} + {calc.trailingPlateMarginMm.toFixed(1)}<br />= <strong>{calc.calculatedPlateRepeatMm.toFixed(1)} mm</strong>{active.registrationMarkPitchMm !== undefined && <><br />Registration pitch override = <strong>{calc.plateRepeatMm.toFixed(1)} mm</strong></>}</code></div></div></Section>}
        <button className="purchase-cta" onClick={() => setTab("purchase")}><span>Generate Die Purchase Specification</span><b>→</b></button>
      </aside>
    </div>}

    {tab === "library" && <Library state={state} active={active} setState={setApplicationState} setTab={setTab} setToast={setToast} importRef={importRef} />}
    {tab === "machines" && <MachineProfiles state={state} setState={setApplicationState} />}
    {tab === "purchase" && <PurchaseView active={active} purchase={purchase} policy={purchasePolicy} onExport={() => callbacks?.onExport?.({ state, purchaseJson: purchaseJsonPayload, purchaseCsv: purchaseCsvPayload })} />}
    {toast && <div className="toast" role="status">✓ {toast}</div>}
  </main>;
}

function Library({ state, active, setState, setTab, setToast, importRef }: { state: SavedState; active: DieSpecification; setState: React.Dispatch<React.SetStateAction<SavedState>>; setTab: (tab: Tab) => void; setToast: (value: string) => void; importRef: React.RefObject<HTMLInputElement> }) {
  const [filter, setFilter] = useState(""); const [showArchived, setShowArchived] = useState(false);
  const dies = state.dieSpecifications.filter((die) => (showArchived || !die.archived) && `${die.name} ${die.certificate.supplier ?? ""} ${die.certificate.material ?? ""}`.toLowerCase().includes(filter.toLowerCase()));
  const duplicate = (die: DieSpecification) => { const copy = { ...structuredClone(die), id: crypto.randomUUID(), name: `${die.name} · Copy`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), archived: false }; setState((current) => ({ ...current, dieSpecifications: [...current.dieSpecifications, copy], activeDieId: copy.id })); setToast("Die duplicated"); };
  const remove = (die: DieSpecification) => { if (state.dieSpecifications.length <= 1) { window.alert("The final die cannot be deleted. Duplicate it or import another valid die first."); return; } if (!window.confirm(`Permanently delete “${die.name}”?`)) return; setState((current) => { const remaining = current.dieSpecifications.filter((item) => item.id !== die.id); return { ...current, dieSpecifications: remaining, activeDieId: current.activeDieId === die.id ? remaining[0].id : current.activeDieId }; }); };
  return <section className="page-view"><div className="page-title"><div><span className="eyebrow">REUSABLE TOOLING</span><h2>Die library</h2><p>Search, compare and reload production dies.</p></div><div className="button-row"><input ref={importRef} hidden type="file" accept="application/json" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; try { const raw = await file.text(); setState((current) => importState(raw, current)); setToast("Import completed"); } catch (error) { window.alert(error instanceof Error ? error.message : "Invalid import"); } }} /><button className="secondary" onClick={() => importRef.current?.click()}>Import JSON</button><button className="secondary" onClick={() => download("digital-dies.json", exportState(state))}>Export all</button><button className="primary" onClick={() => duplicate(active)}>New from current</button></div></div>
    <div className="library-tools"><input placeholder="Search die, supplier or material…" value={filter} onChange={(e) => setFilter(e.target.value)} /><label className="check"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived</label></div>
    <div className="die-table" role="table"><div className="table-row head"><span>Die</span><span>Geometry</span><span>Layout</span><span>Machine / cylinder</span><span>Updated</span><span>Actions</span></div>{dies.map((die) => { const finisher = state.finisherProfiles.find((item) => item.id === die.finisherProfileId); const cylinder = finisher?.cylinders.find((item) => item.id === die.cylinderProfileId); return <div className="table-row" key={die.id}><span><b>{die.name}</b><small>{die.certificate.supplier} · {die.certificate.supplierToolNumber}</small>{die.archived && <em>Archived</em>}</span><span>{die.label.widthMm} × {die.label.lengthMm} mm<small>{die.label.shape === "circle" ? `Ø${die.label.widthMm}` : die.label.shape === "roundedRectangle" ? `R${die.label.cornerRadiusMm}` : "No corner radius"} · {die.label.shape}</small></span><span>{die.layout.labelsAcross} across × {die.layout.labelsAround} around<small>{die.layout.gapAcrossMm} / {die.layout.gapAroundMm} mm gaps</small></span><span>{finisher?.name ?? "Unknown finisher"}<small>{die.dieCutMode} · {cylinder ? `${cylinder.teeth}Z / ${cylinder.certifiedCircumferenceMm.toFixed(1)} mm` : die.cylinderProfileId ? "Unknown cylinder" : "No cylinder"}</small></span><span>{new Date(die.updatedAt).toLocaleDateString("en-DK")}</span><span className="row-actions"><button onClick={() => { setState((current) => ({ ...current, activeDieId: die.id })); setTab("calculator"); }}>Load</button><button onClick={() => duplicate(die)}>Duplicate</button><button onClick={() => setState((current) => ({ ...current, dieSpecifications: current.dieSpecifications.map((item) => item.id === die.id ? { ...item, archived: !item.archived } : item) }))}>{die.archived ? "Restore" : "Archive"}</button><button className="danger" disabled={state.dieSpecifications.length <= 1} title={state.dieSpecifications.length <= 1 ? "The final die cannot be deleted" : undefined} onClick={() => remove(die)}>Delete</button></span></div>; })}</div>
  </section>;
}

function MachineProfiles({ state, setState }: { state: SavedState; setState: React.Dispatch<React.SetStateAction<SavedState>> }) {
  const press = state.pressProfiles[0]; const finisher = state.finisherProfiles[0]; const cylinder = finisher.cylinders[0];
  const cylinderLimits = calculateSemiRotaryLimits(cylinder);
  const updatePress = (patch: Partial<PressProfile>) => setState((current) => ({ ...current, pressProfiles: current.pressProfiles.map((item) => item.id === press.id ? { ...item, ...patch } : item) }));
  const updateFinisher = (patch: Partial<FinisherProfile>) => setState((current) => ({ ...current, finisherProfiles: current.finisherProfiles.map((item) => item.id === finisher.id ? { ...item, ...patch } : item) }));
  const restoreProfileDefaults = () => {
    if (!window.confirm("Restore default machine profiles? This keeps your die library unchanged.")) return;
    const seed = cloneSeed();
    setState((current) => ({ ...current, pressProfiles: seed.pressProfiles, finisherProfiles: seed.finisherProfiles }));
  };
  return <section className="page-view"><div className="page-title"><div><span className="eyebrow">CONFIGURED CONSTRAINTS</span><h2>Machine profiles</h2><p>Verified values and deliberately unconfigured limits stay clearly separate.</p></div><button className="secondary" onClick={restoreProfileDefaults}>Restore supplied defaults</button></div><div className="profile-grid"><article className={`profile-card ${press.locallyVerified ? "verified" : ""}`}><div className="profile-head"><span>PRESS</span><b>{press.locallyVerified ? "Verified" : "Local verification required"}</b></div><h3>{press.name}</h3><p>{press.manufacturer} · {press.model}</p><NumberField label="Maximum printable width" value={press.maxPrintableWidthMm} onChange={(value) => updatePress({ maxPrintableWidthMm: value })} /><NumberField label="Maximum print repeat" value={press.maxPrintRepeatMm} onChange={(value) => updatePress({ maxPrintRepeatMm: value })} /><label className="check"><input type="checkbox" checked={press.locallyVerified} onChange={(e) => updatePress({ locallyVerified: e.target.checked })} /> Values checked on installed press</label></article>
    <article className="profile-card"><div className="profile-head"><span>FINISHER</span><b>Digital mode</b></div><h3>{finisher.name}</h3><p>{finisher.manufacturer} · {finisher.model}</p><dl><div><dt>Cutting plate margin</dt><dd>{FIXED_CUTTING_PLATE_MARGIN_MM.toFixed(1)} mm on every side</dd></div></dl><label className="check"><input type="checkbox" checked={finisher.physicalWebCheckRequiredForOrdering} onChange={(e) => updateFinisher({ physicalWebCheckRequiredForOrdering: e.target.checked })} /> Require physical web verification for human review</label><label className="check"><input type="checkbox" checked={finisher.registrationMarkCheckRequiredForReview} onChange={(e) => updateFinisher({ registrationMarkCheckRequiredForReview: e.target.checked })} /> Require registration-mark confirmation</label><label className="check"><input type="checkbox" checked={finisher.sensorCheckRequiredForReview} onChange={(e) => updateFinisher({ sensorCheckRequiredForReview: e.target.checked })} /> Require sensor / eye-mark confirmation</label><label className="check"><input type="checkbox" checked={finisher.dielineReferenceRequiredForReview} onChange={(e) => updateFinisher({ dielineReferenceRequiredForReview: e.target.checked })} /> Require a dieline reference</label><label className="check"><input type="checkbox" checked={finisher.tolerancesCheckRequiredForReview} onChange={(e) => updateFinisher({ tolerancesCheckRequiredForReview: e.target.checked })} /> Require tolerance confirmation</label><label className="check"><input type="checkbox" checked={finisher.supplierNotesRequiredForReview} onChange={(e) => updateFinisher({ supplierNotesRequiredForReview: e.target.checked })} /> Require supplier notes</label><label className="check"><input type="checkbox" checked={finisher.operatorReviewRequiredForReview} onChange={(e) => updateFinisher({ operatorReviewRequiredForReview: e.target.checked })} /> Require operator review confirmation</label><dl><div><dt>Operating mode</dt><dd>Semi-rotary</dd></div><div><dt>Software maximum</dt><dd>{cylinder.machineSoftwareMaxPlateLengthMm.toFixed(1)} mm</dd></div></dl></article>
    <article className="profile-card certified"><div className="profile-head"><span>CYLINDER</span><b>Certificate</b></div><h3>{cylinder.name}</h3><p>{cylinder.source}</p><dl><div><dt>Tooth count</dt><dd>{cylinder.teeth}Z</dd></div><div><dt>Nominal circumference</dt><dd>{cylinderLimits.nominalCylinderCircumferenceMm.toFixed(1)} mm</dd></div><div><dt>Certified circumference</dt><dd>{cylinder.certifiedCircumferenceMm.toFixed(1)} mm</dd></div><div><dt>Recommended plate range</dt><dd>{cylinderLimits.recommendedMinimumPlateLengthMm.toFixed(1)}–{cylinderLimits.recommendedMaximumPlateLengthMm.toFixed(1)} mm</dd></div><div><dt>Reserved motion zone</dt><dd>{cylinderLimits.reservedSemiRotaryMotionZoneMm.toFixed(1)} mm</dd></div></dl><div className="authority-note">✓ Specification validation uses the recommended plate range. The 635.0 mm circumference is not usable plate length.</div></article></div></section>;
}

function PurchaseView({ active, purchase, policy, onExport }: { active: DieSpecification; purchase: DiePurchaseSpecification; policy: ReturnType<typeof getPurchaseExportPolicy>; onExport?: () => void }) {
  const text = formatPurchaseText(purchase);
  const danishText = formatDanishPurchaseText(purchase);
  const fields = purchaseCertificateFields(purchase);
  const json = JSON.stringify({ documentStatus: policy.documentLabel, ...fields }, null, 2);
  const mm = (value: number | null) => value === null ? "—" : `${value.toFixed(1)} mm`;
  const rows: Array<[string, string]> = [
    ["Circumference", mm(fields.circumferenceMm)],
    ["Cylinder teeth / module", fields.cylinderTeethModule?.toString() ?? "—"],
    ["Plate repeat", mm(fields.plateRepeatMm)],
    ["Labels across", fields.labelsAcross.toString()],
    ["Labels around", fields.labelsAround.toString()],
    ["Label width", mm(fields.labelWidthMm)],
    ["Label length", mm(fields.labelLengthMm)],
    ["Label diameter", mm(fields.labelDiameterMm)],
    ["Gap across", mm(fields.gapAcrossMm)],
    ["Gap machine direction", mm(fields.gapMachineDirectionMm)],
    ["Radius", mm(fields.radiusMm)],
  ];
  const blockedTitle = policy.blocked ? `Resolve blocking geometry issues: ${policy.reasons.join("; ")}` : undefined;
  return <section className="page-view purchase-page"><div className="page-title"><div><span className="eyebrow">HUMAN-REVIEWED SUPPLIER REQUEST</span><h2>Die purchase specification</h2><p>The app prepares this document; a person reviews and sends it manually.</p></div><div className="button-row"><button className="secondary" disabled={!policy.copy} title={blockedTitle} onClick={() => navigator.clipboard.writeText(text)}>Copy purchase specification</button><button className="secondary" disabled={!policy.draftCsv} title={blockedTitle} onClick={() => { onExport?.(); download(`${active.id}-purchase.csv`, exportPurchaseCsv(purchase), "text/csv"); }}>{policy.draft ? "Export draft CSV" : "Export CSV"}</button><button className="secondary" disabled={!policy.draftJson} title={blockedTitle} onClick={() => { onExport?.(); download(`${active.id}-purchase.json`, json); }}>{policy.draft ? "Export draft JSON" : "Export JSON"}</button><button className="primary" disabled={!policy.print} title={blockedTitle} onClick={() => window.print()}>Print specification</button></div></div>
    <div className={`purchase-guard ${policy.blocked ? "blocked" : policy.draft ? "warning" : "ready"}`} role={policy.blocked ? "alert" : "status"}><strong>{policy.documentLabel}</strong><span>{policy.blocked ? `Exports are disabled until the geometry is valid. ${policy.reasons.join("; ")}.` : policy.draft ? "Geometry is valid. Exports remain visibly marked as drafts until all required specification checks are complete." : "All required specification checks are complete. The document is ready for human review and manual sending."}</span></div>
    <article className="purchase-sheet minimal-spec"><div className="sheet-header"><div><small>{policy.documentLabel}</small><h3>DIE PURCHASE SPECIFICATION</h3></div></div><dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></article>
    <article className="purchase-sheet generated-text"><div className="generated-text-head"><div><small>GENERERET SPECIFIKATIONSTEKST</small><h3>{policy.documentLabel}</h3></div><button className="secondary" disabled={!policy.copy} title={blockedTitle} onClick={() => navigator.clipboard.writeText(danishText)}>Kopiér tekst</button></div><div className="danish-text-preview"><strong>Størrelse:</strong><strong>Etiketbredde: {new Intl.NumberFormat("da-DK", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(fields.labelWidthMm)} mm</strong><strong>Etiketlængde: {new Intl.NumberFormat("da-DK", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(fields.labelLengthMm)} mm</strong><br /><p><strong>Antal tværs:</strong> {fields.labelsAcross}<br /><strong>Antal rundt:</strong> {fields.labelsAround}<br /><strong>Afstand tværs:</strong> {new Intl.NumberFormat("da-DK", { maximumFractionDigits: 1 }).format(fields.gapAcrossMm)} mm<br /><strong>Afstand rundt:</strong> {fields.gapMachineDirectionMm === null ? "—" : `${new Intl.NumberFormat("da-DK", { maximumFractionDigits: 1 }).format(fields.gapMachineDirectionMm)} mm`}<br /><strong>Hjørneradius:</strong> {fields.radiusMm === null ? "—" : `${new Intl.NumberFormat("da-DK", { maximumFractionDigits: 1 }).format(fields.radiusMm)} mm`}<br /><strong>Mark:</strong> {purchase.job.mark?.trim() || "—"}<br />{purchase.cuttingTool.extraTreatment?.trim().toLowerCase() === "laser" ? "Med laser hærdning" : <><strong>Behandling:</strong> {purchase.cuttingTool.extraTreatment?.trim() || "—"}</>}<br /><strong>Medie:</strong> {purchase.material.faceMaterial?.trim() || "—"}</p></div></article>
  </section>;
}
