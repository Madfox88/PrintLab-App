import type { DieSpecification, FinisherProfile, PressProfile, SavedState } from "../domain/models";

export const pressProfile: PressProfile = {
  id: "press-ws6600", name: "HP Indigo WS6600", manufacturer: "HP", model: "Indigo WS6600",
  maxPrintableWidthMm: 317, maxPrintRepeatMm: 980, locallyVerified: true,
  notes: "317 mm printable width and 980 mm maximum repeat confirmed for the installed press.",
};

export const finisherProfile: FinisherProfile = {
  id: "finisher-dc330-mini", name: "GM DC330 Mini", manufacturer: "GM", model: "DC330 Mini",
  supportedModes: ["none", "cylinderOff", "fullRotary", "semiRotary"],
  physicalWebCheckRequiredForOrdering: true,
  registrationMarkCheckRequiredForReview: true,
  sensorCheckRequiredForReview: true,
  tolerancesCheckRequiredForReview: false,
  dielineReferenceRequiredForReview: true,
  supplierNotesRequiredForReview: false,
  operatorReviewRequiredForReview: false,
  maxWebWidthMm: 333,
  maxSemiRotaryRepeatMm: 558.8, defaultCuttingMarginMm: 10, defaultDistortionFactor: 1,
  cylinders: [{
    id: "cylinder-200z-635", name: "200Z Certified Example", teeth: 200,
    certifiedCircumferenceMm: 635, recommendedMinPlateLengthMm: 190.5,
    recommendedMaxPlateLengthMm: 520.7, machineSoftwareMaxPlateLengthMm: 558.8,
    source: "Wink quality certificate dated 2026-06-18", certified: true,
    notes: "The 635.0 mm circumference is distinct from the recommended 190.5–520.7 mm semi-rotary plate range.",
  }],
  notes: "Semi-rotary repeat and web-width limits require local verification.",
};

const stamp = "2026-06-18T00:00:00.000Z";
export const sampleDie: DieSpecification = {
  id: "die-wink-48x196", name: "KB 48×196 / PP – 200Z",
  pressProfileId: pressProfile.id, finisherProfileId: finisherProfile.id,
  cylinderProfileId: "cylinder-200z-635", dieCutMode: "semiRotary",
  label: { shape: "roundedRectangle", widthMm: 48, lengthMm: 196, cornerRadiusMm: 2, rotationDegrees: 0 },
  layout: { labelsAcross: 6, labelsAround: 1, gapAcrossMm: 4, gapAroundMm: 0, autoCenter: true, staggered: false },
  cuttingMarginMm: 10, cuttingMarginMode: "outsideLayout", cuttingMarginConfirmed: true,
  leadingPlateMarginMm: 0, trailingPlateMarginMm: 0, plateMarginsVerification: "unknown",
  physicalWebVerification: "unknown",
  registrationRequirementsVerification: "unknown", sensorRequirementsVerification: "unknown",
  tolerancesVerification: "unknown", operatorReviewVerification: "unknown",
  distortionFactor: 1, distortionAxis: "none", distortionResponsibility: "notRequired",
  plateWidthMm: 328, plateLengthMm: 216, cuttingRepeatMm: 196,
  materialName: "PP white FTC60 / RP37 / HD-FSC",
  certificate: {
    supplier: "Wink", supplierToolNumber: "26062450261", customer: "Multimarketing",
    orderReference: "KB 48x196/PP", certificateDate: "2026-06-18", dieQuality: "SuperCut 70",
    material: "PP white FTC60 / RP37 / HD-FSC", backingThicknessMm: 0.0509,
    dieHeightMm: 0.445, residualPlateThicknessMm: 0.15, perforation: false, extraTreatment: "Laser",
  },
  archived: false, createdAt: stamp, updatedAt: stamp,
};

export const initialState: SavedState = {
  schemaVersion: 1, pressProfiles: [pressProfile], finisherProfiles: [finisherProfile],
  dieSpecifications: [sampleDie], activeDieId: sampleDie.id,
};

export function cloneSeed(): SavedState { return structuredClone(initialState); }
