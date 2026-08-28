import type { ChecklistBlockingLevel, CylinderProfile, DiePurchaseSpecification, DieSpecification, FinisherProfile, LayoutCalculation, PressProfile, PurchaseChecklistItem, PurchaseSpecificationStatus } from "./models";
import { nearlyEqual } from "./units.ts";
import { FIXED_CUTTING_PLATE_MARGIN_MM } from "./calculations.ts";

export interface PurchaseOverrides {
  supplier?: string; contactName?: string; contactEmail?: string; requiredDeliveryDate?: string;
  dimensionalToleranceMm?: number; gapToleranceMm?: number; repeatToleranceMm?: number; registrationToleranceMm?: number;
  registrationMarkRequired?: boolean; registrationMarkType?: string; registrationMarkPosition?: string;
  sensorType?: string; sensorOffsetMm?: number; webDirectionConfirmed?: boolean; unwindDirection?: string;
  geometryCheckedBy?: string; machineCheckedBy?: string; purchasingApprovedBy?: string;
  createdBy?: string; dielineFilename?: string; revision?: number;
}

const verified = (state: DieSpecification["plateMarginsVerification"]): boolean => state === "confirmed" || state === "notRequired";
const item = (id: string, label: string, required: boolean, complete: boolean, blockingLevel: ChecklistBlockingLevel, message?: string, nextAction?: string): PurchaseChecklistItem => ({
  id, label, required, complete, blockingLevel,
  state: complete ? "complete" : required ? "requiresVerification" : "notApplicable",
  message, nextAction,
});

const hasCompletePhysicalWebData = (die: DieSpecification): boolean =>
  die.webWidthMm !== undefined && die.requiredLeftEdgeMarginMm !== undefined && die.requiredRightEdgeMarginMm !== undefined;

export interface SpecificationChecklistEvaluation {
  items: PurchaseChecklistItem[];
  incompleteRequired: PurchaseChecklistItem[];
  status: PurchaseSpecificationStatus;
}

export function evaluateSpecificationChecklist(
  die: DieSpecification, calculation: LayoutCalculation, press: PressProfile,
  finisher: FinisherProfile, cylinder: CylinderProfile | undefined, overrides: PurchaseOverrides = {},
): SpecificationChecklistEvaluation {
  const plateDimensionsComplete = Number.isFinite(calculation.requiredPlateWidthMm) && calculation.requiredPlateWidthMm > 0 && Number.isFinite(calculation.requiredPlateLengthMm) && calculation.requiredPlateLengthMm > 0;
  const physicalWebComplete = verified(die.physicalWebVerification) && hasCompletePhysicalWebData(die) && calculation.fitsPhysicalWebWidth !== false;
  const machineProfileComplete = press.locallyVerified && calculation.warnings.every((warning) => !["press-default", "CYLINDER_NOMINAL_CERTIFIED_MISMATCH"].includes(warning.id));
  const plateRepeatComplete = calculation.plateRepeatMm > 0 && calculation.errors.every((error) => !["registration-pitch-invalid", "PLATE_GEOMETRY_EXCEEDS_REPEAT", "PLATE_REPEAT_BELOW_RECOMMENDED_MINIMUM", "PLATE_REPEAT_EXCEEDS_RECOMMENDED_MAXIMUM"].includes(error.id));
  const cuttingMarginComplete = die.cuttingMarginMm === FIXED_CUTTING_PLATE_MARGIN_MM && die.cuttingMarginMode === "outsideLayout";
  const items: PurchaseChecklistItem[] = [
    item("plate-dimensions", "Plate dimensions are valid", true, plateDimensionsComplete, "geometry", "Required plate width and length must be positive.", "Correct the geometry or cutting margin."),
    item("machine-profile", machineProfileComplete ? "Machine profile verified" : "Machine profile requires verification", true, machineProfileComplete, "machineVerification", "Local machine limits and the nominal/certified cylinder relationship must be verified.", "Review the machine profile."),
    item("cylinder-identification", "Cylinder identification confirmed", true, Boolean(cylinder?.id && cylinder.certified), "machineVerification", "Select a certified cylinder.", "Select and verify the magnetic cylinder."),
    item("cylinder-circumference", "Cylinder circumference confirmed", true, Boolean(cylinder && cylinder.certifiedCircumferenceMm > 0), "machineVerification", "A certified circumference is required.", "Verify the cylinder certificate."),
    item("plate-repeat", plateRepeatComplete ? "Registration-mark pitch is valid" : "Registration-mark pitch is outside the allowed range", true, plateRepeatComplete, "machineVerification", "The complete cutting repeat must fit the configured machine limits.", "Correct or verify the registration-mark pitch."),
    item("cutting-margin", cuttingMarginComplete ? "Fixed 10 mm plate margin applied on every side" : "Fixed 10 mm plate margin is not applied", true, cuttingMarginComplete, "geometry", "The plate must extend 10 mm beyond the occupied layout on the left, right, leading, and trailing sides.", "Restore the fixed plate-margin rule."),
    item("cut-position-spacing", verified(die.plateMarginsVerification) ? "Cut-position spacing confirmed" : "Cut-position spacing requires confirmation", true, verified(die.plateMarginsVerification), "machineVerification", "Leading and trailing cut-position spacing must be explicitly confirmed or marked not required.", "Review cut-position spacing."),
    item("registration-mark", verified(die.registrationRequirementsVerification) ? "Registration-mark requirements confirmed" : "Registration-mark requirements require confirmation", finisher.registrationMarkCheckRequiredForReview, verified(die.registrationRequirementsVerification), "machineVerification", "Confirm the registration-mark requirements for this machine profile.", "Review registration-mark requirements."),
    item("sensor", verified(die.sensorRequirementsVerification) ? "Sensor / eye-mark requirements confirmed" : "Sensor / eye-mark requirements require confirmation", finisher.sensorCheckRequiredForReview, verified(die.sensorRequirementsVerification), "machineVerification", "Confirm the sensor or eye-mark requirements.", "Review sensor requirements."),
    item("physical-web", physicalWebComplete ? "Physical web suitability confirmed" : "Physical web suitability requires review", finisher.physicalWebCheckRequiredForOrdering, physicalWebComplete, "supplierReview", "Confirm web width and required left/right edge margins.", "Review physical web suitability."),
    item("material", "Material / web information provided", true, Boolean(die.certificate.material?.trim()), "supplierReview", "Material construction is required in the specification.", "Enter the media construction."),
    item("tolerances", verified(die.tolerancesVerification) ? "Tolerance requirements confirmed" : "Tolerance requirements require review", finisher.tolerancesCheckRequiredForReview, verified(die.tolerancesVerification), "supplierReview", "Confirm dimensional, gap, repeat, and registration tolerances.", "Review tolerance requirements."),
    item("dieline", "Dieline attached or referenced", finisher.dielineReferenceRequiredForReview, Boolean(overrides.dielineFilename?.trim() || die.certificate.referenceFile?.trim()), "supplierReview", "Attach or reference the dieline used for manufacture.", "Add a dieline reference."),
    item("supplier-notes", "Supplier notes provided", finisher.supplierNotesRequiredForReview, Boolean(die.certificate.notes?.trim()), "supplierReview", "Add any supplier-specific manufacturing notes.", "Add supplier notes."),
    item("operator-review", verified(die.operatorReviewVerification) ? "Reviewed by operator" : "Operator review pending", finisher.operatorReviewRequiredForReview, verified(die.operatorReviewVerification), "supplierReview", "Record the internal human review when required by the profile.", "Mark as reviewed by operator."),
  ];
  const incompleteRequired = items.filter((entry) => entry.required && !entry.complete);
  const status: PurchaseSpecificationStatus = calculation.errors.length > 0 || incompleteRequired.some((entry) => entry.blockingLevel === "geometry")
    ? "invalid"
    : incompleteRequired.some((entry) => entry.blockingLevel === "machineVerification")
      ? "requiresMachineVerification"
      : incompleteRequired.some((entry) => entry.blockingLevel === "supplierReview")
        ? "requiresSupplierReview"
        : "readyForHumanReview";
  return { items, incompleteRequired, status };
}

export function generatePurchaseSpecification(
  die: DieSpecification, calculation: LayoutCalculation, press: PressProfile,
  finisher: FinisherProfile, cylinder: CylinderProfile | undefined, overrides: PurchaseOverrides = {},
): DiePurchaseSpecification {
  const marginConfirmed = die.cuttingMarginMm === FIXED_CUTTING_PLATE_MARGIN_MM && die.cuttingMarginMode === "outsideLayout";
  const plateWidth = die.cuttingMarginMode === "outsideLayout" ? calculation.requiredPlateWidthMm : die.plateWidthMm;
  const plateLength = die.cuttingMarginMode === "outsideLayout" ? calculation.requiredPlateLengthMm : die.plateLengthMm;
  const checklistEvaluation = evaluateSpecificationChecklist(die, calculation, press, finisher, cylinder, overrides);
  const checklist = checklistEvaluation.items;
  const missingInformation = checklistEvaluation.incompleteRequired.map((entry) => entry.label);
  const supplierQuestions: string[] = [];
  if (die.plateMarginsVerification === "unknown") supplierQuestions.push(`Please confirm the ${calculation.leadingPlateMarginMm.toFixed(1)} mm leading-edge-to-first-cut spacing and ${calculation.trailingPlateMarginMm.toFixed(1)} mm final-cut-to-next-repeat spacing used in the ${calculation.plateRepeatMm.toFixed(1)} mm registration-mark pitch.`);
  if (finisher.physicalWebCheckRequiredForOrdering && (die.physicalWebVerification !== "confirmed" || die.webWidthMm === undefined || die.requiredLeftEdgeMarginMm === undefined || die.requiredRightEdgeMarginMm === undefined)) supplierQuestions.push("Please confirm physical web width and the required left and right die edge margins.");
  if (finisher.registrationMarkCheckRequiredForReview && !verified(die.registrationRequirementsVerification)) supplierQuestions.push("Please confirm registration-mark requirements for this job.");
  if (finisher.sensorCheckRequiredForReview && !verified(die.sensorRequirementsVerification)) supplierQuestions.push("Please confirm sensor or eye-mark requirements for this job.");
  if (!finisher.maxSemiRotaryRepeatMm && die.dieCutMode === "semiRotary") supplierQuestions.push(`Please confirm the semi-rotary repeat for ${finisher.model} with ${cylinder?.name ?? "the selected magnetic cylinder"}.`);
  if (die.distortionResponsibility === "unknown") supplierQuestions.push("Please confirm whether the supplier should apply distortion or whether the supplied dieline already includes it.");
  if (finisher.tolerancesCheckRequiredForReview && !verified(die.tolerancesVerification)) supplierQuestions.push("Please confirm dimensional, gap, repeat, and registration tolerances before manufacture.");
  const status = checklistEvaluation.status;
  const now = new Date().toISOString();
  return {
    id: `purchase-${die.id}`, specificationNumber: `DDS-${now.slice(0, 10).split("-").join("")}-${die.id.slice(-4).toUpperCase()}`,
    revision: overrides.revision ?? 1, status, createdAt: now, updatedAt: now, createdBy: overrides.createdBy,
    customer: { companyName: die.certificate.customer ?? "Multimarketing", contactName: overrides.contactName, email: overrides.contactEmail },
    supplier: { companyName: overrides.supplier ?? die.certificate.supplier },
    job: { dieName: die.name, mark: die.certificate.mark, internalOrderReference: die.certificate.orderReference, requiredDeliveryDate: overrides.requiredDeliveryDate },
    machine: { pressManufacturer: press.manufacturer, pressModel: press.model, finisherManufacturer: finisher.manufacturer, finisherModel: finisher.model, dieCutMode: die.dieCutMode },
    cylinder: { cylinderName: cylinder?.name, teeth: cylinder?.teeth, certifiedCircumferenceMm: cylinder?.certifiedCircumferenceMm, recommendedMinPlateLengthMm: cylinder?.recommendedMinPlateLengthMm, recommendedMaxPlateLengthMm: cylinder?.recommendedMaxPlateLengthMm, machineSoftwareMaxPlateLengthMm: cylinder?.machineSoftwareMaxPlateLengthMm, magneticCylinder: true, cylinderReference: cylinder?.source },
    label: { shape: die.label.shape, finishedWidthMm: die.label.widthMm, finishedLengthMm: die.label.lengthMm, cornerRadiusMm: die.label.cornerRadiusMm, rotationDegrees: die.label.rotationDegrees },
    layout: { labelsAcross: die.layout.labelsAcross, labelsAround: die.layout.labelsAround, gapAcrossMm: die.layout.gapAcrossMm, gapAroundMm: die.layout.gapAroundMm, occupiedWidthMm: calculation.occupiedWidthMm, occupiedLengthMm: calculation.occupiedLabelLengthMm, totalLabelsPerRepeat: calculation.totalLabelsPerRepeat, staggered: die.layout.staggered },
    plate: { requiredPlateWidthMm: plateWidth, requiredPlateLengthMm: plateLength, cuttingRepeatMm: calculation.plateRepeatMm, occupiedLabelLengthMm: calculation.occupiedLabelLengthMm, leadingPlateMarginMm: calculation.leadingPlateMarginMm, trailingPlateMarginMm: calculation.trailingPlateMarginMm, cuttingMarginMm: FIXED_CUTTING_PLATE_MARGIN_MM, cuttingMarginMode: "outsideLayout", dimensionsProvisional: !marginConfirmed || die.plateMarginsVerification === "unknown", distortionFactor: die.distortionFactor, distortionAxis: die.distortionAxis, distortionResponsibility: die.distortionResponsibility },
    material: { faceMaterial: die.certificate.material, backingThicknessMm: die.certificate.backingThicknessMm },
    cuttingTool: { dieQuality: die.certificate.dieQuality, bladeHeightMm: die.certificate.dieHeightMm, residualPlateThicknessMm: die.certificate.residualPlateThicknessMm, extraTreatment: die.certificate.extraTreatment, perforation: die.certificate.perforation },
    registration: { registrationMarkRequired: overrides.registrationMarkRequired ?? true, registrationMarkType: overrides.registrationMarkType, registrationMarkPosition: overrides.registrationMarkPosition, sensorType: overrides.sensorType, sensorOffsetMm: overrides.sensorOffsetMm, webDirectionConfirmed: overrides.webDirectionConfirmed ?? false, unwindDirection: overrides.unwindDirection },
    tolerances: { dimensionalToleranceMm: overrides.dimensionalToleranceMm, gapToleranceMm: overrides.gapToleranceMm, repeatToleranceMm: overrides.repeatToleranceMm, registrationToleranceMm: overrides.registrationToleranceMm },
    suppliedFiles: { dieLineFile: overrides.dielineFilename, certificateFile: die.certificate.referenceFile },
    approvals: { geometryCheckedBy: overrides.geometryCheckedBy, machineCompatibilityCheckedBy: overrides.machineCheckedBy, purchasingApprovedBy: overrides.purchasingApprovedBy, approvalDate: overrides.purchasingApprovedBy ? now : undefined },
    assumptions: ["Certified cylinder circumference is distinct from the recommended semi-rotary plate range.", "Normal specification validation uses the selected cylinder's recommended plate limits, not the machine software maximum."],
    missingInformation, warnings: [...calculation.warnings.map((warning) => warning.title), ...(marginConfirmed ? [] : ["Plate dimensions are provisional"])], supplierQuestions, checklist,
  };
}

export interface PurchaseCertificateFields {
  circumferenceMm: number | null;
  cylinderTeethModule: number | null;
  labelsAcross: number;
  labelsAround: number;
  labelWidthMm: number;
  labelLengthMm: number;
  labelDiameterMm: number | null;
  gapAcrossMm: number;
  gapMachineDirectionMm: number | null;
  radiusMm: number | null;
  plateRepeatMm: number | null;
}

export function purchaseCertificateFields(spec: DiePurchaseSpecification): PurchaseCertificateFields {
  const isRound = spec.label.shape === "circle";
  // Supplier certificate terminology is directional: width is always across
  // the web and length is always around/in the machine direction.
  const rotated = spec.label.rotationDegrees === 90;
  return {
    circumferenceMm: spec.cylinder.certifiedCircumferenceMm ?? null,
    cylinderTeethModule: spec.cylinder.teeth ?? null,
    labelsAcross: spec.layout.labelsAcross,
    labelsAround: spec.layout.labelsAround,
    labelWidthMm: rotated ? spec.label.finishedLengthMm : spec.label.finishedWidthMm,
    labelLengthMm: rotated ? spec.label.finishedWidthMm : spec.label.finishedLengthMm,
    labelDiameterMm: isRound ? spec.label.finishedWidthMm : null,
    gapAcrossMm: spec.layout.gapAcrossMm,
    gapMachineDirectionMm: spec.layout.labelsAround > 1 ? spec.layout.gapAroundMm : null,
    radiusMm: spec.label.shape === "circle" ? spec.label.finishedWidthMm / 2 : spec.label.shape === "roundedRectangle" ? spec.label.cornerRadiusMm ?? null : null,
    plateRepeatMm: spec.plate.cuttingRepeatMm ?? null,
  };
}

export interface PurchaseExportPolicy {
  blocked: boolean;
  draft: boolean;
  reasons: string[];
  copy: boolean; draftCsv: boolean; draftJson: boolean; print: boolean; unqualifiedSpecification: boolean;
  documentLabel: "INVALID PURCHASE SPECIFICATION" | "DRAFT — REQUIRES MACHINE VERIFICATION" | "DRAFT PURCHASE SPECIFICATION — REQUIRES HUMAN REVIEW" | "PURCHASE SPECIFICATION — READY FOR HUMAN REVIEW";
}

export function getPurchaseExportPolicy(spec: DiePurchaseSpecification): PurchaseExportPolicy {
  const blocked = spec.status === "invalid";
  const draft = spec.status !== "invalid" && spec.status !== "readyForHumanReview";
  const reasons = spec.checklist.filter((entry) => entry.required && !entry.complete).map((entry) => entry.label);
  return {
    blocked,
    draft,
    reasons: reasons.filter((value, index, values) => values.indexOf(value) === index),
    copy: !blocked, draftCsv: !blocked, draftJson: !blocked, print: !blocked,
    unqualifiedSpecification: spec.status === "readyForHumanReview",
    documentLabel: spec.status === "invalid"
      ? "INVALID PURCHASE SPECIFICATION"
      : spec.status === "requiresMachineVerification"
        ? "DRAFT — REQUIRES MACHINE VERIFICATION"
        : spec.status === "requiresSupplierReview"
          ? "DRAFT PURCHASE SPECIFICATION — REQUIRES HUMAN REVIEW"
          : "PURCHASE SPECIFICATION — READY FOR HUMAN REVIEW",
  };
}

export function formatPurchaseText(spec: DiePurchaseSpecification): string {
  const fields = purchaseCertificateFields(spec);
  const policy = getPurchaseExportPolicy(spec);
  const mm = (value: number | null) => value === null ? "—" : `${value.toFixed(1)} mm`;
  return `${policy.documentLabel}\n\nDIE PURCHASE SPECIFICATION\n\nCircumference: ${mm(fields.circumferenceMm)}\nCylinder teeth / module: ${fields.cylinderTeethModule ?? "—"}\nPlate repeat: ${mm(fields.plateRepeatMm)}\nLabels across: ${fields.labelsAcross}\nLabels around: ${fields.labelsAround}\nLabel width: ${mm(fields.labelWidthMm)}\nLabel length: ${mm(fields.labelLengthMm)}\nLabel diameter: ${mm(fields.labelDiameterMm)}\nGap across: ${mm(fields.gapAcrossMm)}\nGap machine direction: ${mm(fields.gapMachineDirectionMm)}\nRadius: ${mm(fields.radiusMm)}`;
}

export function formatDanishPurchaseText(spec: DiePurchaseSpecification): string {
  const fields = purchaseCertificateFields(spec);
  const decimal = (value: number) => new Intl.NumberFormat("da-DK", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
  const compact = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("da-DK", { maximumFractionDigits: 1 }).format(value);
  const treatment = spec.cuttingTool.extraTreatment?.trim().toLowerCase() === "laser"
    ? "Med laser hærdning"
    : spec.cuttingTool.extraTreatment?.trim() ? `Behandling: ${spec.cuttingTool.extraTreatment.trim()}` : "Laser hærdning: —";
  return `Størrelse:\nEtiketbredde: ${decimal(fields.labelWidthMm)} mm\nEtiketlængde: ${decimal(fields.labelLengthMm)} mm\n\nAntal tværs: ${fields.labelsAcross}\nAntal rundt: ${fields.labelsAround}\nAfstand tværs: ${compact(fields.gapAcrossMm)} mm\nAfstand rundt: ${compact(fields.gapMachineDirectionMm)}${fields.gapMachineDirectionMm === null ? "" : " mm"}\nHjørneradius: ${compact(fields.radiusMm)}${fields.radiusMm === null ? "" : " mm"}\nMark: ${spec.job.mark?.trim() || "—"}\n${treatment}\nMedie: ${spec.material.faceMaterial?.trim() || "—"}`;
}

export type ReuseMatch = { die: DieSpecification; status: "exact" | "possible"; differences: string[] };
export function findReusableDies(proposed: DieSpecification, saved: DieSpecification[], toleranceMm = 0.1): ReuseMatch[] {
  return saved.filter((die) => die.id !== proposed.id && !die.archived).map((die) => {
    const differences: string[] = [];
    if (die.finisherProfileId !== proposed.finisherProfileId) differences.push("machine");
    if (die.dieCutMode !== proposed.dieCutMode) differences.push("mode");
    if (die.cylinderProfileId !== proposed.cylinderProfileId) differences.push("cylinder");
    if (die.label.shape !== proposed.label.shape) differences.push("shape");
    if (!nearlyEqual(die.label.widthMm, proposed.label.widthMm, toleranceMm)) differences.push("label width");
    if (!nearlyEqual(die.label.lengthMm, proposed.label.lengthMm, toleranceMm)) differences.push("label length");
    if (!nearlyEqual(die.label.cornerRadiusMm, proposed.label.cornerRadiusMm, toleranceMm)) differences.push("radius");
    if (die.layout.labelsAcross !== proposed.layout.labelsAcross || die.layout.labelsAround !== proposed.layout.labelsAround) differences.push("layout count");
    if (!nearlyEqual(die.layout.gapAcrossMm, proposed.layout.gapAcrossMm, toleranceMm) || !nearlyEqual(die.layout.gapAroundMm, proposed.layout.gapAroundMm, toleranceMm)) differences.push("gaps");
    if (die.certificate.perforation !== proposed.certificate.perforation) differences.push("perforation");
    if (differences.length === 0) return { die, status: "exact" as const, differences };
    if (!differences.some((value) => ["machine", "mode", "cylinder", "shape", "layout count"].includes(value)) && differences.length <= 3) return { die, status: "possible" as const, differences };
    return null;
  }).filter((match): match is ReuseMatch => match !== null);
}

export function exportPurchaseCsv(spec: DiePurchaseSpecification): string {
  const fields = purchaseCertificateFields(spec);
  const policy = getPurchaseExportPolicy(spec);
  const headers = ["Document Status","Circumference mm","Cylinder Teeth Module","Plate Repeat mm","Labels Across","Labels Around","Label Width mm","Label Length mm","Label Diameter mm","Gap Across mm","Gap Machine Direction mm","Radius mm"];
  const values = [policy.documentLabel,fields.circumferenceMm ?? "",fields.cylinderTeethModule ?? "",fields.plateRepeatMm ?? "",fields.labelsAcross,fields.labelsAround,fields.labelWidthMm,fields.labelLengthMm,fields.labelDiameterMm ?? "",fields.gapAcrossMm,fields.gapMachineDirectionMm ?? "",fields.radiusMm ?? ""];
  const csv = (value: unknown) => `"${String(value).split('"').join('""')}"`;
  return `${headers.map(csv).join(",")}\n${values.map(csv).join(",")}`;
}

export function invalidateApprovedPurchase(spec: DiePurchaseSpecification, changedFields: string[]): DiePurchaseSpecification {
  if (changedFields.length === 0) return spec;
  return {
    ...spec,
    revision: spec.revision + 1,
    status: "requiresMachineVerification",
    updatedAt: new Date().toISOString(),
    revisionNotes: `Geometry changed: ${changedFields.join(", ")}`,
    approvals: {},
    warnings: [...spec.warnings, "Prior approval invalidated by geometry changes."],
  };
}
