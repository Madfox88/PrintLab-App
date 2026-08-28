export type DieCutMode = "none" | "cylinderOff" | "fullRotary" | "semiRotary";
export type CuttingMarginMode = "outsideLayout" | "includedInPlateDimensions";
export type DistortionAxis = "none" | "across" | "around";
export type VerificationState = "unknown" | "confirmed" | "notRequired";
export type PurchaseSpecificationStatus = "invalid" | "requiresMachineVerification" | "requiresSupplierReview" | "readyForHumanReview";
export type PurchaseReadiness = PurchaseSpecificationStatus;
export type ChecklistState = "complete" | "missing" | "requiresVerification" | "notApplicable";
export type ChecklistBlockingLevel = "geometry" | "machineVerification" | "supplierReview" | "informational";
export type MessageLevel = "error" | "warning" | "information";

export interface CylinderProfile {
  id: string; name: string; teeth: number; certifiedCircumferenceMm: number;
  recommendedMinPlateLengthMm: number; recommendedMaxPlateLengthMm: number;
  machineSoftwareMaxPlateLengthMm: number;
  source?: string; notes?: string; certified: boolean;
}

export interface PressProfile {
  id: string; name: string; manufacturer: string; model: string;
  maxPrintableWidthMm: number; maxPrintRepeatMm: number; locallyVerified: boolean; notes?: string;
}

export interface FinisherProfile {
  id: string; name: string; manufacturer: string; model: string;
  maxWebWidthMm?: number; minWebWidthMm?: number; maxSemiRotaryRepeatMm?: number;
  supportedModes: DieCutMode[]; defaultCuttingMarginMm: number;
  physicalWebCheckRequiredForOrdering: boolean;
  registrationMarkCheckRequiredForReview: boolean;
  sensorCheckRequiredForReview: boolean;
  tolerancesCheckRequiredForReview: boolean;
  dielineReferenceRequiredForReview: boolean;
  supplierNotesRequiredForReview: boolean;
  operatorReviewRequiredForReview: boolean;
  defaultDistortionFactor: number; cylinders: CylinderProfile[]; notes?: string;
}

export interface CertificateMetadata {
  supplier?: string; supplierToolNumber?: string; customer?: string; orderReference?: string;
  certificateDate?: string; operator?: string; dieQuality?: string; material?: string; mark?: string;
  backingThicknessMm?: number; dieHeightMm?: number; residualPlateThicknessMm?: number;
  perforation: boolean; extraTreatment?: string; referenceFile?: string; notes?: string;
}

export interface DieSpecification {
  id: string; name: string; pressProfileId: string; finisherProfileId: string;
  cylinderProfileId?: string; dieCutMode: DieCutMode;
  label: {
    shape: "rectangle" | "roundedRectangle" | "circle" | "ellipse" | "custom";
    widthMm: number; lengthMm: number; cornerRadiusMm: number; rotationDegrees: 0 | 90;
  };
  layout: {
    labelsAcross: number; labelsAround: number; gapAcrossMm: number; gapAroundMm: number;
    offsetAcrossMm?: number; offsetAroundMm?: number; autoCenter: boolean;
    staggered: boolean; staggerOffsetMm?: number;
  };
  cuttingMarginMm: number; cuttingMarginMode: CuttingMarginMode;
  cuttingMarginConfirmed: boolean; distortionFactor: number; distortionAxis: DistortionAxis;
  distortionResponsibility: "supplierToApply" | "alreadyAppliedInFile" | "notRequired" | "unknown";
  plateWidthMm?: number; plateLengthMm?: number; cuttingRepeatMm?: number; seamAllowanceMm?: number;
  leadingPlateMarginMm?: number; trailingPlateMarginMm?: number; plateMarginsVerification: VerificationState;
  /** Legacy import field. Runtime logic uses plateMarginsVerification. */
  plateMarginsConfirmed?: boolean;
  registrationMarkPitchMm?: number;
  webWidthMm?: number; requiredLeftEdgeMarginMm?: number; requiredRightEdgeMarginMm?: number;
  physicalWebVerification: VerificationState;
  /** Legacy import field. Runtime logic uses physicalWebVerification. */
  physicalWebConfirmed?: boolean;
  registrationRequirementsVerification: VerificationState;
  sensorRequirementsVerification: VerificationState;
  tolerancesVerification: VerificationState;
  operatorReviewVerification: VerificationState;
  materialName?: string; certificate: CertificateMetadata; archived: boolean;
  createdAt: string; updatedAt: string;
}

export interface ValidationMessage {
  id: string; level: MessageLevel; title: string; detail: string;
  actionLabel?: string; relatedFieldId?: string;
}

export interface LayoutCalculation {
  effectiveLabelWidthMm: number; effectiveLabelLengthMm: number;
  occupiedWidthMm: number; occupiedLabelLengthMm: number;
  widthRemainingMm: number; repeatRemainingMm: number;
  leftOffsetMm: number; rightOffsetMm: number; leadingOffsetMm: number; trailingOffsetMm: number;
  totalLabelsPerRepeat: number; labelsPerLinearMeter: number;
  layoutUtilizationPercent: number; pressWidthUtilizationPercent: number;
  requiredPlateWidthMm: number; requiredPlateLengthMm: number;
  leadingPlateMarginMm: number; trailingPlateMarginMm: number; calculatedPlateRepeatMm: number;
  plateRepeatMm: number; finalCutPositionMm: number; plateRepeatRemainingMm?: number;
  recommendedMinimumPlateLengthMm?: number; recommendedMaximumPlateLengthMm?: number;
  machineSoftwareMaximumPlateLengthMm?: number; maximumLabelsAround?: number;
  plateLengthUtilizationPercent?: number; nominalCylinderCircumferenceMm?: number;
  reservedSemiRotaryMotionZoneMm?: number;
  physicalWebRequiredWidthMm?: number; physicalWebRemainingMm?: number;
  usablePlateWidthMm?: number; usablePlateLengthMm?: number; circumferenceRemainingMm?: number;
  fitsPressWidth: boolean; fitsPressRepeat: boolean;
  fitsPlateWidth: boolean | null; fitsPlateLength: boolean | null; fitsCylinderCircumference: boolean | null;
  fitsSemiRotaryPlateLength: boolean | null;
  fitsPhysicalWebWidth: boolean | null;
  status: "valid" | "invalid" | "requiresVerification";
  errors: ValidationMessage[]; warnings: ValidationMessage[]; information: ValidationMessage[];
}

export interface DielineFileMetadata {
  filename?: string; format?: "PDF" | "SVG" | "AI" | "DXF" | "EPS"; revision?: string;
  units?: "mm" | "inch"; scaleConfirmed: boolean; fontsOutlined?: boolean; pathsClosed?: boolean;
  duplicatePathsChecked?: boolean; webDirectionShown?: boolean; repeatReferenceShown?: boolean;
  distortionIncluded?: boolean;
}

export interface PurchaseChecklistItem {
  id: string; label: string; required: boolean; complete: boolean;
  blockingLevel: ChecklistBlockingLevel; state: ChecklistState;
  message?: string; nextAction?: string;
}

export interface DiePurchaseSpecification {
  id: string; specificationNumber: string; revision: number; status: PurchaseReadiness;
  createdAt: string; updatedAt: string; createdBy?: string; revisionNotes?: string;
  customer: { companyName: string; contactName?: string; email?: string; phone?: string; deliveryAddress?: string };
  supplier?: { companyName?: string; contactName?: string; email?: string; supplierReference?: string };
  job: { dieName: string; mark?: string; customerJobReference?: string; internalOrderReference?: string; artworkReference?: string; previousDieReference?: string; requiredDeliveryDate?: string; requestedQuantity?: number };
  machine: { pressManufacturer: string; pressModel: string; finisherManufacturer: string; finisherModel: string; dieCutMode: DieCutMode };
  cylinder: { cylinderName?: string; teeth?: number; certifiedCircumferenceMm?: number; recommendedMinPlateLengthMm?: number; recommendedMaxPlateLengthMm?: number; machineSoftwareMaxPlateLengthMm?: number; magneticCylinder?: boolean; cylinderReference?: string };
  label: { shape: string; finishedWidthMm: number; finishedLengthMm: number; cornerRadiusMm?: number; rotationDegrees: 0 | 90 };
  layout: { labelsAcross: number; labelsAround: number; gapAcrossMm: number; gapAroundMm: number; occupiedWidthMm: number; occupiedLengthMm: number; totalLabelsPerRepeat: number; staggered: boolean };
  plate: { requiredPlateWidthMm?: number; requiredPlateLengthMm?: number; cuttingRepeatMm?: number; occupiedLabelLengthMm?: number; leadingPlateMarginMm?: number; trailingPlateMarginMm?: number; cuttingMarginMm: number; cuttingMarginMode: CuttingMarginMode; dimensionsProvisional: boolean; distortionFactor: number; distortionAxis: DistortionAxis; distortionResponsibility: DieSpecification["distortionResponsibility"] };
  material: { faceMaterial?: string; backingThicknessMm?: number };
  cuttingTool: { dieQuality?: string; bladeHeightMm?: number; residualPlateThicknessMm?: number; extraTreatment?: string; perforation: boolean; perforationDetails?: string };
  registration: { registrationMarkRequired: boolean; registrationMarkType?: string; registrationMarkPosition?: string; sensorType?: string; sensorOffsetMm?: number; webDirectionConfirmed: boolean; unwindDirection?: string };
  tolerances: { dimensionalToleranceMm?: number; gapToleranceMm?: number; repeatToleranceMm?: number; registrationToleranceMm?: number };
  suppliedFiles: { dieLineFile?: string; artworkFile?: string; certificateFile?: string; referenceImageFiles?: string[] };
  approvals: { geometryCheckedBy?: string; machineCompatibilityCheckedBy?: string; purchasingApprovedBy?: string; approvalDate?: string };
  assumptions: string[]; missingInformation: string[]; warnings: string[]; supplierQuestions: string[];
  checklist: PurchaseChecklistItem[]; notes?: string;
}

export interface SavedState {
  schemaVersion: 1; pressProfiles: PressProfile[]; finisherProfiles: FinisherProfile[];
  dieSpecifications: DieSpecification[]; activeDieId: string;
}
