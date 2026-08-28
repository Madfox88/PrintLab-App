import type { CylinderProfile, DieSpecification, FinisherProfile, PressProfile, SavedState } from "../domain/models";
import { FIXED_CUTTING_PLATE_MARGIN_MM } from "../domain/calculations.ts";
import { circumferenceFromTeeth, CYLINDER_CIRCUMFERENCE_TOLERANCE_MM } from "../domain/units.ts";
import { cloneSeed } from "./seed.ts";

export const STORAGE_KEY = "digital-die-designer-v1";

export type HydrationStatus = "loading" | "valid" | "recoveryRequired" | "empty";
export interface RecoveryState {
  rawPayload: string;
  parseError?: string;
  validationErrors: string[];
  detectedAtIso: string;
}
export type HydrationResult =
  | { status: "valid" | "empty"; state: SavedState; recovery?: undefined }
  | { status: "recoveryRequired"; state?: undefined; recovery: RecoveryState };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

const KNOWN_200Z_LIMITS = {
  recommendedMinPlateLengthMm: 190.5,
  recommendedMaxPlateLengthMm: 520.7,
  machineSoftwareMaxPlateLengthMm: 558.8,
};

function normalizeCylinder(raw: unknown): CylinderProfile {
  if (!isRecord(raw) || !isNonEmptyString(raw.id) || !isNonEmptyString(raw.name)) throw new Error("Every cylinder must have a valid ID and name.");
  if (!isFiniteNumber(raw.teeth) || !Number.isInteger(raw.teeth) || raw.teeth <= 0) throw new Error(`Cylinder “${raw.name}” must have a positive whole-number tooth count.`);
  if (!isFiniteNumber(raw.certifiedCircumferenceMm) || raw.certifiedCircumferenceMm <= 0) throw new Error(`Cylinder “${raw.name}” must have a positive certified circumference.`);
  const nominalMismatchMm = Math.abs(circumferenceFromTeeth(raw.teeth) - raw.certifiedCircumferenceMm);
  const known200Z = raw.teeth === 200 && nominalMismatchMm <= CYLINDER_CIRCUMFERENCE_TOLERANCE_MM;
  const recommendedMinPlateLengthMm = raw.recommendedMinPlateLengthMm ?? (known200Z ? KNOWN_200Z_LIMITS.recommendedMinPlateLengthMm : undefined);
  const recommendedMaxPlateLengthMm = raw.recommendedMaxPlateLengthMm ?? (known200Z ? KNOWN_200Z_LIMITS.recommendedMaxPlateLengthMm : undefined);
  const machineSoftwareMaxPlateLengthMm = raw.machineSoftwareMaxPlateLengthMm ?? (known200Z ? KNOWN_200Z_LIMITS.machineSoftwareMaxPlateLengthMm : undefined);
  if (!isFiniteNumber(recommendedMinPlateLengthMm) || recommendedMinPlateLengthMm <= 0 || !isFiniteNumber(recommendedMaxPlateLengthMm) || recommendedMaxPlateLengthMm <= 0 || !isFiniteNumber(machineSoftwareMaxPlateLengthMm) || machineSoftwareMaxPlateLengthMm <= 0) throw new Error(`Cylinder “${raw.name}” is missing valid semi-rotary plate limits.`);
  if (recommendedMinPlateLengthMm > recommendedMaxPlateLengthMm) throw new Error(`Cylinder “${raw.name}” has a minimum plate length above its maximum.`);
  if (recommendedMaxPlateLengthMm > raw.certifiedCircumferenceMm) throw new Error(`Cylinder “${raw.name}” has a recommended plate maximum above its certified circumference.`);
  if (recommendedMaxPlateLengthMm > machineSoftwareMaxPlateLengthMm) throw new Error(`Cylinder “${raw.name}” has a recommended plate maximum above the machine software maximum.`);
  // A nominal/certified mismatch with explicit plate limits remains importable
  // so the central calculator can surface a machine-verification warning.
  return {
    id: raw.id,
    name: raw.name,
    teeth: raw.teeth,
    certifiedCircumferenceMm: raw.certifiedCircumferenceMm,
    recommendedMinPlateLengthMm,
    recommendedMaxPlateLengthMm,
    machineSoftwareMaxPlateLengthMm,
    source: typeof raw.source === "string" ? raw.source : undefined,
    notes: typeof raw.notes === "string" ? raw.notes : undefined,
    certified: raw.certified === true,
  };
}

function normalizeFinishers(raw: unknown[]): FinisherProfile[] {
  return raw.map((value) => {
    if (!isRecord(value) || !isNonEmptyString(value.id) || !Array.isArray(value.cylinders)) throw new Error("Every finisher must have a valid ID and cylinder library.");
    return {
      ...(value as unknown as FinisherProfile),
      defaultCuttingMarginMm: FIXED_CUTTING_PLATE_MARGIN_MM,
      physicalWebCheckRequiredForOrdering: value.physicalWebCheckRequiredForOrdering !== false,
      registrationMarkCheckRequiredForReview: value.registrationMarkCheckRequiredForReview !== false,
      sensorCheckRequiredForReview: value.sensorCheckRequiredForReview !== false,
      tolerancesCheckRequiredForReview: value.tolerancesCheckRequiredForReview === true,
      dielineReferenceRequiredForReview: value.dielineReferenceRequiredForReview !== false,
      supplierNotesRequiredForReview: value.supplierNotesRequiredForReview === true,
      operatorReviewRequiredForReview: value.operatorReviewRequiredForReview === true,
      cylinders: value.cylinders.map(normalizeCylinder),
    };
  });
}

function normalizeDie(raw: unknown, presses: PressProfile[], finishers: FinisherProfile[]): DieSpecification {
  if (!isRecord(raw) || !isNonEmptyString(raw.id) || !isNonEmptyString(raw.name)) throw new Error("Every imported die must have a valid ID and name.");
  if (!isNonEmptyString(raw.pressProfileId) || !presses.some((press) => press.id === raw.pressProfileId)) throw new Error(`Die “${raw.name}” references an unknown press profile.`);
  if (!isNonEmptyString(raw.finisherProfileId)) throw new Error(`Die “${raw.name}” is missing its finisher profile.`);
  const finisher = finishers.find((item) => item.id === raw.finisherProfileId);
  if (!finisher) throw new Error(`Die “${raw.name}” references an unknown finisher profile.`);
  if (raw.cylinderProfileId !== undefined && (!isNonEmptyString(raw.cylinderProfileId) || !finisher.cylinders.some((item) => item.id === raw.cylinderProfileId))) throw new Error(`Die “${raw.name}” references an unknown cylinder profile.`);
  if (!isRecord(raw.label) || !["rectangle", "roundedRectangle", "circle", "ellipse"].includes(String(raw.label.shape))) throw new Error(`Die “${raw.name}” has an unsupported label shape.`);
  if (!isFiniteNumber(raw.label.widthMm) || raw.label.widthMm <= 0 || !isFiniteNumber(raw.label.lengthMm) || raw.label.lengthMm <= 0) throw new Error(`Die “${raw.name}” must have positive label dimensions.`);
  if (!isFiniteNumber(raw.label.cornerRadiusMm) || raw.label.cornerRadiusMm < 0 || ![0, 90].includes(Number(raw.label.rotationDegrees))) throw new Error(`Die “${raw.name}” has invalid radius or rotation data.`);
  if (!isRecord(raw.layout) || !Number.isInteger(raw.layout.labelsAcross) || Number(raw.layout.labelsAcross) <= 0 || !Number.isInteger(raw.layout.labelsAround) || Number(raw.layout.labelsAround) <= 0) throw new Error(`Die “${raw.name}” must have positive whole-number layout counts.`);
  if (!isFiniteNumber(raw.layout.gapAcrossMm) || raw.layout.gapAcrossMm < 0 || !isFiniteNumber(raw.layout.gapAroundMm) || raw.layout.gapAroundMm < 0) throw new Error(`Die “${raw.name}” has invalid gap values.`);
  if (!isRecord(raw.certificate) || typeof raw.certificate.perforation !== "boolean") throw new Error(`Die “${raw.name}” has invalid certificate data.`);
  if (typeof raw.archived !== "boolean" || !isNonEmptyString(raw.createdAt) || !isNonEmptyString(raw.updatedAt)) throw new Error(`Die “${raw.name}” is missing library metadata.`);
  for (const [label, value] of [["leading plate margin", raw.leadingPlateMarginMm], ["trailing plate margin", raw.trailingPlateMarginMm], ["left edge margin", raw.requiredLeftEdgeMarginMm], ["right edge margin", raw.requiredRightEdgeMarginMm]] as const) {
    if (value !== undefined && (!isFiniteNumber(value) || value < 0)) throw new Error(`Die “${raw.name}” has an invalid ${label}.`);
  }
  if (raw.registrationMarkPitchMm !== undefined && (!isFiniteNumber(raw.registrationMarkPitchMm) || raw.registrationMarkPitchMm <= 0)) throw new Error(`Die “${raw.name}” has an invalid registration-mark pitch.`);
  if (raw.webWidthMm !== undefined && (!isFiniteNumber(raw.webWidthMm) || raw.webWidthMm <= 0)) throw new Error(`Die “${raw.name}” has an invalid physical web width.`);
  if (!isFiniteNumber(raw.cuttingMarginMm) || raw.cuttingMarginMm < 0) throw new Error(`Die “${raw.name}” has an invalid cutting plate margin.`);

  const die = raw as unknown as DieSpecification;
  const verificationState = (value: unknown, legacyConfirmed: unknown): DieSpecification["physicalWebVerification"] =>
    value === "confirmed" || value === "notRequired" || value === "unknown" ? value : legacyConfirmed === true ? "confirmed" : "unknown";
  const plateMarginsVerification: DieSpecification["plateMarginsVerification"] = raw.plateMarginsVerification === "confirmed" || raw.plateMarginsVerification === "notRequired" || raw.plateMarginsVerification === "unknown"
    ? raw.plateMarginsVerification
    : "unknown";
  const circleDiameter = die.label.shape === "circle" ? die.label.widthMm : undefined;
  return {
    ...die,
    dieCutMode: "semiRotary",
    label: {
      ...die.label,
      lengthMm: circleDiameter ?? die.label.lengthMm,
      cornerRadiusMm: die.label.shape === "circle" ? die.label.widthMm / 2 : die.label.shape === "roundedRectangle" ? die.label.cornerRadiusMm : 0,
    },
    layout: { ...die.layout, staggered: false, staggerOffsetMm: undefined },
    cuttingMarginMm: FIXED_CUTTING_PLATE_MARGIN_MM,
    cuttingMarginMode: "outsideLayout",
    cuttingMarginConfirmed: true,
    leadingPlateMarginMm: die.leadingPlateMarginMm ?? 0,
    trailingPlateMarginMm: die.trailingPlateMarginMm ?? 0,
    plateMarginsVerification,
    physicalWebVerification: verificationState(raw.physicalWebVerification, raw.physicalWebConfirmed),
    registrationRequirementsVerification: verificationState(raw.registrationRequirementsVerification, undefined),
    sensorRequirementsVerification: verificationState(raw.sensorRequirementsVerification, undefined),
    tolerancesVerification: verificationState(raw.tolerancesVerification, undefined),
    operatorReviewVerification: verificationState(raw.operatorReviewVerification, undefined),
    plateMarginsConfirmed: undefined,
    physicalWebConfirmed: undefined,
    distortionFactor: 1,
    distortionAxis: "none",
    distortionResponsibility: "notRequired",
  };
}

function normalizeState(raw: unknown): SavedState {
  if (!isRecord(raw) || raw.schemaVersion !== 1 || !Array.isArray(raw.pressProfiles) || raw.pressProfiles.length === 0 || !Array.isArray(raw.finisherProfiles) || raw.finisherProfiles.length === 0 || !Array.isArray(raw.dieSpecifications) || raw.dieSpecifications.length === 0) throw new Error("Saved data is incomplete.");
  const presses = (raw.pressProfiles as PressProfile[]).map((press) => press.id === "press-ws6600" ? { ...press, locallyVerified: true } : press);
  const finishers = normalizeFinishers(raw.finisherProfiles);
  const dies = raw.dieSpecifications.map((die) => normalizeDie(die, presses, finishers));
  if (new Set(dies.map((die) => die.id)).size !== dies.length) throw new Error("Die IDs must be unique.");
  const requestedActiveId = typeof raw.activeDieId === "string" ? raw.activeDieId : "";
  return { schemaVersion: 1, pressProfiles: presses, finisherProfiles: finishers, dieSpecifications: dies, activeDieId: dies.some((die) => die.id === requestedActiveId) ? requestedActiveId : dies[0].id };
}

function normalizeImportedDies(raw: unknown, current: SavedState): SavedState {
  if (!isRecord(raw) || raw.schemaVersion !== 1) throw new Error("Unsupported or missing schema version.");
  if (!Array.isArray(raw.dieSpecifications)) throw new Error("Import does not contain a dieSpecifications array.");
  if (raw.dieSpecifications.length === 0) throw new Error("Import must contain at least one die.");
  let presses = current.pressProfiles;
  let finishers = current.finisherProfiles;

  if (Array.isArray(raw.pressProfiles) && Array.isArray(raw.finisherProfiles) && raw.pressProfiles.length > 0 && raw.finisherProfiles.length > 0) {
    presses = (raw.pressProfiles as PressProfile[]).map((press) => press.id === "press-ws6600" ? { ...press, locallyVerified: true } : press);
    finishers = normalizeFinishers(raw.finisherProfiles);
  } else if (Array.isArray(raw.machineProfiles) && raw.machineProfiles.length > 0) {
    const machineProfiles = raw.machineProfiles.filter(isRecord);
    const pressCandidates = machineProfiles.filter((profile) => isFiniteNumber(profile.maxPrintableWidthMm) && isFiniteNumber(profile.maxPrintRepeatMm));
    const finisherCandidates = machineProfiles.filter((profile) => Array.isArray(profile.cylinders));
    if (pressCandidates.length > 0 && finisherCandidates.length > 0) {
      presses = (pressCandidates as unknown as PressProfile[]).map((press) => press.id === "press-ws6600" ? { ...press, locallyVerified: true } : press);
      finishers = normalizeFinishers(finisherCandidates);
    }
  }

  const dies = raw.dieSpecifications.map((die) => normalizeDie(die, presses, finishers));
  if (new Set(dies.map((die) => die.id)).size !== dies.length) throw new Error("Imported die IDs must be unique.");
  const requestedActiveId = typeof raw.activeDieId === "string" ? raw.activeDieId : "";
  return {
    ...current,
    pressProfiles: presses,
    finisherProfiles: finishers,
    dieSpecifications: dies,
    activeDieId: dies.some((die) => die.id === requestedActiveId) ? requestedActiveId : dies[0].id,
  };
}

export function hydrateState(): HydrationResult {
  if (typeof window === "undefined") return { status: "empty", state: cloneSeed() };
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) return { status: "empty", state: cloneSeed() };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { status: "recoveryRequired", recovery: { rawPayload: raw, parseError: error instanceof Error ? error.message : "Saved JSON could not be parsed.", validationErrors: [], detectedAtIso: new Date().toISOString() } };
  }
  try {
    return { status: "valid", state: normalizeState(parsed) };
  } catch (error) {
    return { status: "recoveryRequired", recovery: { rawPayload: raw, validationErrors: [error instanceof Error ? error.message : "Saved data failed validation."], detectedAtIso: new Date().toISOString() } };
  }
}

export function loadState(): SavedState {
  const result = hydrateState();
  if (result.status === "recoveryRequired") throw new Error(result.recovery.parseError ?? result.recovery.validationErrors.join("; "));
  return result.state;
}

export function canAutosave(status: HydrationStatus, persistenceLocked = false): boolean { return status === "valid" && !persistenceLocked; }
export function resetSavedState(): void { if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY); }

export function saveState(state: SavedState): void {
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function exportState(state: SavedState): string {
  return JSON.stringify({
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    pressProfiles: state.pressProfiles,
    finisherProfiles: state.finisherProfiles,
    activeDieId: state.activeDieId,
    dieSpecifications: state.dieSpecifications,
  }, null, 2);
}

export function importState(raw: string, current: SavedState): SavedState {
  return normalizeImportedDies(JSON.parse(raw), current);
}
