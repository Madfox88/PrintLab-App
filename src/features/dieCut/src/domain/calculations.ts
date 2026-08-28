import type { CylinderProfile, DieSpecification, FinisherProfile, LayoutCalculation, PressProfile, ValidationMessage } from "./models";
import { circumferenceFromTeeth, CYLINDER_CIRCUMFERENCE_TOLERANCE_MM } from "./units.ts";

export const FIXED_CUTTING_PLATE_MARGIN_MM = 10;

const msg = (id: string, level: ValidationMessage["level"], title: string, detail: string, actionLabel?: string, relatedFieldId?: string): ValidationMessage => ({ id, level, title, detail, actionLabel, relatedFieldId });
const safe = (value: number) => Number.isFinite(value) ? value : 0;

export interface SemiRotaryLimits {
  nominalCylinderCircumferenceMm: number;
  recommendedMinimumPlateLengthMm: number;
  recommendedMaximumPlateLengthMm: number;
  machineSoftwareMaximumPlateLengthMm: number;
  reservedSemiRotaryMotionZoneMm: number;
}

export function calculateSemiRotaryLimits(cylinder: CylinderProfile): SemiRotaryLimits {
  return {
    nominalCylinderCircumferenceMm: circumferenceFromTeeth(cylinder.teeth),
    recommendedMinimumPlateLengthMm: cylinder.recommendedMinPlateLengthMm,
    recommendedMaximumPlateLengthMm: cylinder.recommendedMaxPlateLengthMm,
    machineSoftwareMaximumPlateLengthMm: cylinder.machineSoftwareMaxPlateLengthMm,
    reservedSemiRotaryMotionZoneMm: cylinder.certifiedCircumferenceMm - cylinder.recommendedMaxPlateLengthMm,
  };
}

export function calculateLayout(die: DieSpecification, press: PressProfile, finisher: FinisherProfile): LayoutCalculation {
  const cylinder = finisher.cylinders.find((item) => item.id === die.cylinderProfileId);
  const limits = cylinder ? calculateSemiRotaryLimits(cylinder) : undefined;
  const rotated = die.label.rotationDegrees === 90;
  const effectiveLabelWidthMm = safe(rotated ? die.label.lengthMm : die.label.widthMm);
  const effectiveLabelLengthMm = safe(rotated ? die.label.widthMm : die.label.lengthMm);
  const across = safe(die.layout.labelsAcross);
  const around = safe(die.layout.labelsAround);
  const gapAcrossMm = Math.max(0, safe(die.layout.gapAcrossMm));
  const gapAroundMm = Math.max(0, safe(die.layout.gapAroundMm));
  const occupiedWidthMm = across * effectiveLabelWidthMm + Math.max(across - 1, 0) * gapAcrossMm;
  const occupiedLabelLengthMm = around * effectiveLabelLengthMm + Math.max(around - 1, 0) * gapAroundMm;
  const leadingPlateMarginMm = Math.max(0, safe(die.leadingPlateMarginMm ?? 0));
  const trailingPlateMarginMm = Math.max(0, safe(die.trailingPlateMarginMm ?? 0));
  const calculatedPlateRepeatMm = leadingPlateMarginMm + occupiedLabelLengthMm + trailingPlateMarginMm;
  const hasRegistrationMarkPitch = die.registrationMarkPitchMm !== undefined;
  const plateRepeatMm = hasRegistrationMarkPitch ? safe(die.registrationMarkPitchMm ?? 0) : calculatedPlateRepeatMm;
  const finalCutPositionMm = leadingPlateMarginMm + occupiedLabelLengthMm;
  const widthRemainingMm = press.maxPrintableWidthMm - occupiedWidthMm;
  const repeatRemainingMm = press.maxPrintRepeatMm - plateRepeatMm;
  const leftOffsetMm = die.layout.autoCenter ? widthRemainingMm / 2 : safe(die.layout.offsetAcrossMm ?? 0);
  const rightOffsetMm = press.maxPrintableWidthMm - leftOffsetMm - occupiedWidthMm;
  const leadingOffsetMm = Math.max(repeatRemainingMm / 2, 0);
  const trailingOffsetMm = repeatRemainingMm - leadingOffsetMm;
  const cuttingMargin = FIXED_CUTTING_PLATE_MARGIN_MM;
  const requiredPlateWidthMm = occupiedWidthMm + cuttingMargin * 2;
  const requiredPlateLengthMm = occupiedLabelLengthMm + cuttingMargin * 2;
  const usablePlateWidthMm = die.plateWidthMm === undefined ? undefined : die.plateWidthMm - cuttingMargin * 2;
  const usablePlateLengthMm = die.plateLengthMm === undefined ? undefined : die.plateLengthMm - cuttingMargin * 2;
  const fitsPlateWidth = null;
  const fitsPlateLength = null;
  const usableCircumference = cylinder ? cylinder.certifiedCircumferenceMm - safe(die.seamAllowanceMm ?? 0) : undefined;
  const circumferenceRemainingMm = usableCircumference === undefined ? undefined : usableCircumference - plateRepeatMm;
  const fitsCylinderCircumference = die.dieCutMode === "fullRotary" ? (usableCircumference === undefined ? null : plateRepeatMm <= usableCircumference) : null;
  const recommendedMinimumPlateLengthMm = die.dieCutMode === "semiRotary" ? limits?.recommendedMinimumPlateLengthMm : undefined;
  const recommendedMaximumPlateLengthMm = die.dieCutMode === "semiRotary" ? limits?.recommendedMaximumPlateLengthMm : undefined;
  const machineSoftwareMaximumPlateLengthMm = die.dieCutMode === "semiRotary" ? limits?.machineSoftwareMaximumPlateLengthMm : undefined;
  const plateRepeatRemainingMm = recommendedMaximumPlateLengthMm === undefined ? undefined : recommendedMaximumPlateLengthMm - plateRepeatMm;
  const fitsSemiRotaryPlateLength = die.dieCutMode === "semiRotary"
    ? (recommendedMinimumPlateLengthMm === undefined || recommendedMaximumPlateLengthMm === undefined ? null : plateRepeatMm >= recommendedMinimumPlateLengthMm && plateRepeatMm <= recommendedMaximumPlateLengthMm)
    : null;
  const availableLabelLengthMm = recommendedMaximumPlateLengthMm === undefined ? undefined : Math.max(0, recommendedMaximumPlateLengthMm - leadingPlateMarginMm - trailingPlateMarginMm);
  const aroundPitchMm = effectiveLabelLengthMm + gapAroundMm;
  const maximumLabelsAround = availableLabelLengthMm !== undefined && aroundPitchMm > 0
    ? Math.max(0, Math.floor((availableLabelLengthMm + gapAroundMm) / aroundPitchMm))
    : undefined;
  const hasPhysicalWebData = die.webWidthMm !== undefined && die.requiredLeftEdgeMarginMm !== undefined && die.requiredRightEdgeMarginMm !== undefined;
  const physicalWebRequiredWidthMm = hasPhysicalWebData ? Math.max(0, safe(die.requiredLeftEdgeMarginMm ?? 0)) + occupiedWidthMm + Math.max(0, safe(die.requiredRightEdgeMarginMm ?? 0)) : undefined;
  const physicalWebRemainingMm = physicalWebRequiredWidthMm === undefined ? undefined : safe(die.webWidthMm ?? 0) - physicalWebRequiredWidthMm;
  const fitsPhysicalWebWidth = physicalWebRequiredWidthMm === undefined ? null : physicalWebRequiredWidthMm <= safe(die.webWidthMm ?? 0);
  const errors: ValidationMessage[] = [];
  const warnings: ValidationMessage[] = [];
  const information: ValidationMessage[] = [];

  if (!(die.label.widthMm > 0) || !(die.label.lengthMm > 0)) errors.push(msg("label-dimensions", "error", "Invalid label dimensions", "Width and length must both be greater than zero."));
  if (die.label.shape === "circle" && Math.abs(die.label.widthMm - die.label.lengthMm) > 0.001) errors.push(msg("circle-diameter", "error", "Invalid circle diameter", "A circular label must use the same diameter across and around the web."));
  if (!Number.isInteger(across) || across <= 0 || !Number.isInteger(around) || around <= 0) errors.push(msg("layout-counts", "error", "Invalid layout count", "Labels across and around must be positive whole numbers."));
  if (!Number.isFinite(die.layout.gapAcrossMm) || !Number.isFinite(die.layout.gapAroundMm) || die.layout.gapAcrossMm < 0 || die.layout.gapAroundMm < 0) errors.push(msg("negative-gap", "error", "Invalid production gap", "Across and around gaps must be 0 mm or greater."));
  if (!Number.isFinite(die.leadingPlateMarginMm ?? 0) || !Number.isFinite(die.trailingPlateMarginMm ?? 0) || (die.leadingPlateMarginMm ?? 0) < 0 || (die.trailingPlateMarginMm ?? 0) < 0) errors.push(msg("plate-margin-negative", "error", "Invalid cut-position spacing", "Leading edge to first cut and final cut to next repeat must be 0 mm or greater."));
  if (!Number.isFinite(die.cuttingMarginMm) || die.cuttingMarginMm < 0) errors.push(msg("cutting-margin-negative", "error", "Invalid cutting plate margin", `Cutting plate margin must be ${FIXED_CUTTING_PLATE_MARGIN_MM.toFixed(1)} mm on every side.`));
  else if (die.cuttingMarginMm !== FIXED_CUTTING_PLATE_MARGIN_MM || die.cuttingMarginMode !== "outsideLayout") errors.push(msg("cutting-margin-not-fixed", "error", "Incorrect cutting plate margin", `Cutting plate margin is fixed at ${FIXED_CUTTING_PLATE_MARGIN_MM.toFixed(1)} mm outside the layout on every side.`));
  if (die.webWidthMm !== undefined && (!Number.isFinite(die.webWidthMm) || !(die.webWidthMm > 0))) errors.push(msg("physical-web-invalid", "error", "Invalid physical web width", "Physical web width must be greater than zero when configured."));
  if ((die.requiredLeftEdgeMarginMm !== undefined && (!Number.isFinite(die.requiredLeftEdgeMarginMm) || die.requiredLeftEdgeMarginMm < 0)) || (die.requiredRightEdgeMarginMm !== undefined && (!Number.isFinite(die.requiredRightEdgeMarginMm) || die.requiredRightEdgeMarginMm < 0))) errors.push(msg("edge-margin-invalid", "error", "Invalid physical edge margin", "Required left and right edge margins must be 0 mm or greater."));
  if (hasRegistrationMarkPitch && !(die.registrationMarkPitchMm! > 0)) errors.push(msg("registration-pitch-invalid", "error", "Invalid registration-mark pitch", "Registration-mark pitch must be greater than zero when configured."));
  if (die.label.shape === "roundedRectangle" && (die.label.cornerRadiusMm < 0 || die.label.cornerRadiusMm > Math.min(die.label.widthMm, die.label.lengthMm) / 2)) errors.push(msg("corner-radius", "error", "Invalid corner radius", "Radius cannot exceed half the shortest label dimension."));
  if (occupiedWidthMm > press.maxPrintableWidthMm) errors.push(msg("press-width", "error", "Layout exceeds printable width", `Occupied width exceeds the ${press.maxPrintableWidthMm.toFixed(1)} mm limit by ${(occupiedWidthMm - press.maxPrintableWidthMm).toFixed(1)} mm.`));
  if (plateRepeatMm > press.maxPrintRepeatMm) errors.push(msg("press-repeat", "error", "Plate repeat exceeds press repeat", `Plate repeat exceeds the configured press repeat by ${(plateRepeatMm - press.maxPrintRepeatMm).toFixed(1)} mm.`));
  if (leftOffsetMm < 0 || rightOffsetMm < 0) errors.push(msg("offset", "error", "Layout leaves printable area", "The current positioning creates a negative side offset."));
  if (!finisher.supportedModes.includes(die.dieCutMode)) errors.push(msg("mode", "error", "Unsupported cutting mode", `${finisher.name} does not support the selected mode.`));
  if (fitsCylinderCircumference === false) errors.push(msg("cylinder-fit", "error", "Layout exceeds usable circumference", `Plate repeat exceeds the certified usable circumference by ${Math.abs(circumferenceRemainingMm ?? 0).toFixed(1)} mm.`));
  if (die.dieCutMode === "semiRotary" && recommendedMinimumPlateLengthMm !== undefined && plateRepeatMm < recommendedMinimumPlateLengthMm) errors.push(msg("PLATE_REPEAT_BELOW_RECOMMENDED_MINIMUM", "error", "Plate repeat is below the recommended minimum", `Plate repeat ${plateRepeatMm.toFixed(1)} mm is below the recommended minimum of ${recommendedMinimumPlateLengthMm.toFixed(1)} mm for the ${cylinder?.teeth ?? "selected"}Z / ${cylinder?.certifiedCircumferenceMm.toFixed(1) ?? "unknown"} mm cylinder.`));
  if (die.dieCutMode === "semiRotary" && recommendedMaximumPlateLengthMm !== undefined && plateRepeatMm > recommendedMaximumPlateLengthMm) errors.push(msg("PLATE_REPEAT_EXCEEDS_RECOMMENDED_MAXIMUM", "error", "Plate repeat exceeds the recommended maximum", `Plate repeat ${plateRepeatMm.toFixed(1)} mm exceeds the recommended maximum of ${recommendedMaximumPlateLengthMm.toFixed(1)} mm for the ${cylinder?.teeth ?? "selected"}Z / ${cylinder?.certifiedCircumferenceMm.toFixed(1) ?? "unknown"} mm cylinder by ${(plateRepeatMm - recommendedMaximumPlateLengthMm).toFixed(1)} mm.`));
  if (calculatedPlateRepeatMm > plateRepeatMm) errors.push(msg("PLATE_GEOMETRY_EXCEEDS_REPEAT", "error", "Cut geometry exceeds plate repeat", `Final cut geometry including margins reaches ${calculatedPlateRepeatMm.toFixed(1)} mm, beyond the configured ${plateRepeatMm.toFixed(1)} mm registration-mark pitch.`));
  if (fitsPhysicalWebWidth === false) errors.push(msg("PHYSICAL_WEB_WIDTH_EXCEEDED", "error", "Layout exceeds physical web allowance", `Required physical width ${physicalWebRequiredWidthMm?.toFixed(1)} mm exceeds the configured ${die.webWidthMm?.toFixed(1)} mm web width by ${Math.abs(physicalWebRemainingMm ?? 0).toFixed(1)} mm.`));

  if (!press.locallyVerified) warnings.push(msg("press-default", "warning", "Press profile requires local verification", "The WS6600 limits are editable configuration defaults."));
  if (widthRemainingMm >= 0 && widthRemainingMm < 10) warnings.push(msg("side-clearance", "warning", "Low printable-area clearance", `${widthRemainingMm.toFixed(1)} mm remains across the printable area; this is not a physical edge-margin check.`));
  if ((die.dieCutMode === "semiRotary" || die.dieCutMode === "fullRotary") && !cylinder) warnings.push(msg("cylinder-missing", "warning", "Cylinder not selected", "Select a certified cylinder profile before production."));
  if (cylinder && Math.abs(circumferenceFromTeeth(cylinder.teeth) - cylinder.certifiedCircumferenceMm) > CYLINDER_CIRCUMFERENCE_TOLERANCE_MM) warnings.push(msg("CYLINDER_NOMINAL_CERTIFIED_MISMATCH", "warning", "Nominal and certified circumference differ", `Nominal circumference from ${cylinder.teeth}Z is ${circumferenceFromTeeth(cylinder.teeth).toFixed(1)} mm, while the certified value is ${cylinder.certifiedCircumferenceMm.toFixed(1)} mm.`));
  if (die.plateMarginsVerification === "unknown") warnings.push(msg("PLATE_MARGINS_REQUIRE_VERIFICATION", "warning", "Cut-position spacing requires verification", `Confirm the ${leadingPlateMarginMm.toFixed(1)} mm leading-edge spacing and ${trailingPlateMarginMm.toFixed(1)} mm final-cut spacing used in the ${plateRepeatMm.toFixed(1)} mm repeat.`, "Review cut-position spacing", "cut-position-spacing"));
  if (finisher.physicalWebCheckRequiredForOrdering && (!hasPhysicalWebData || die.physicalWebVerification === "unknown")) warnings.push(msg("PHYSICAL_WEB_DATA_REQUIRES_VERIFICATION", "warning", "Physical web suitability requires supplier review", "Add the physical web width and required edge margins, then confirm them. Geometry remains calculable and draft export is allowed.", "Review physical web", "physical-web-suitability"));
  if (!die.certificate.material) warnings.push(msg("material", "warning", "Material not confirmed", "Material construction is required for a supplier-ready die request."));

  information.push(msg("width-use", "information", "Printable-width use", `Layout uses ${Math.max(0, occupiedWidthMm / press.maxPrintableWidthMm * 100).toFixed(2)}% of printable width.`));
  information.push(msg("width-remain", "information", "Remaining printable width", `${widthRemainingMm.toFixed(1)} mm remains; centered visual clearance is ${(widthRemainingMm / 2).toFixed(1)} mm per side.`));
  information.push(msg("label-total", "information", "Labels per plate repeat", `${across * around} labels: ${across} across × ${around} around.`));
  if (maximumLabelsAround !== undefined) information.push(msg("around-capacity", "information", "Labels around capacity", `${around} entered; maximum ${maximumLabelsAround} within the recommended ${recommendedMaximumPlateLengthMm?.toFixed(1)} mm plate length and configured plate margins.`));
  const totalLabelsPerRepeat = across * around;
  const faceArea = totalLabelsPerRepeat * effectiveLabelWidthMm * effectiveLabelLengthMm;
  const boundArea = occupiedWidthMm * occupiedLabelLengthMm;
  const verificationWarningIds = new Set(["press-default", "cylinder-missing", "CYLINDER_NOMINAL_CERTIFIED_MISMATCH", "PLATE_MARGINS_REQUIRE_VERIFICATION", "PHYSICAL_WEB_DATA_REQUIRES_VERIFICATION"]);
  const status = errors.length ? "invalid" : warnings.some((item) => verificationWarningIds.has(item.id)) ? "requiresVerification" : "valid";
  return {
    effectiveLabelWidthMm, effectiveLabelLengthMm, occupiedWidthMm, occupiedLabelLengthMm,
    widthRemainingMm, repeatRemainingMm, leftOffsetMm, rightOffsetMm, leadingOffsetMm, trailingOffsetMm,
    totalLabelsPerRepeat, labelsPerLinearMeter: plateRepeatMm > 0 ? totalLabelsPerRepeat * 1000 / plateRepeatMm : 0,
    layoutUtilizationPercent: boundArea > 0 ? faceArea / boundArea * 100 : 0,
    pressWidthUtilizationPercent: press.maxPrintableWidthMm > 0 ? occupiedWidthMm / press.maxPrintableWidthMm * 100 : 0,
    requiredPlateWidthMm, requiredPlateLengthMm, leadingPlateMarginMm, trailingPlateMarginMm,
    calculatedPlateRepeatMm, plateRepeatMm, finalCutPositionMm, plateRepeatRemainingMm,
    recommendedMinimumPlateLengthMm, recommendedMaximumPlateLengthMm, machineSoftwareMaximumPlateLengthMm,
    maximumLabelsAround, plateLengthUtilizationPercent: recommendedMaximumPlateLengthMm && recommendedMaximumPlateLengthMm > 0 ? plateRepeatMm / recommendedMaximumPlateLengthMm * 100 : undefined,
    nominalCylinderCircumferenceMm: limits?.nominalCylinderCircumferenceMm,
    reservedSemiRotaryMotionZoneMm: limits?.reservedSemiRotaryMotionZoneMm,
    physicalWebRequiredWidthMm, physicalWebRemainingMm,
    usablePlateWidthMm, usablePlateLengthMm, circumferenceRemainingMm,
    fitsPressWidth: occupiedWidthMm <= press.maxPrintableWidthMm, fitsPressRepeat: plateRepeatMm <= press.maxPrintRepeatMm,
    fitsPlateWidth, fitsPlateLength, fitsCylinderCircumference, fitsSemiRotaryPlateLength, fitsPhysicalWebWidth,
    status, errors, warnings, information,
  };
}
