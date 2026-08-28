import { calculateLayout } from "./calculations.ts";
import type { DieSpecification, FinisherProfile, PressProfile } from "./models";

export interface LayoutOption {
  rotation: 0 | 90;
  labelsAcross: number;
  labelsAround: number;
  occupiedWidthMm: number;
  occupiedLabelLengthMm: number;
  plateRepeatMm: number;
  total: number;
  widthUse: number;
  reason: string;
}

export function optimizeLayouts(base: DieSpecification, press: PressProfile, finisher: FinisherProfile, allowRotation = true, defensiveCap = 50): LayoutOption[] {
  const options: LayoutOption[] = [];
  if (calculateLayout(base, press, finisher).errors.some((error) => ["negative-gap", "plate-margin-negative", "cutting-margin-negative", "cutting-margin-not-fixed", "edge-margin-invalid"].includes(error.id))) return options;
  const cylinder = finisher.cylinders.find((item) => item.id === base.cylinderProfileId);
  const leftEdge = base.requiredLeftEdgeMarginMm ?? 0;
  const rightEdge = base.requiredRightEdgeMarginMm ?? 0;
  const physicalAvailableWidth = base.webWidthMm === undefined ? press.maxPrintableWidthMm : base.webWidthMm - leftEdge - rightEdge;
  const availableWidthMm = Math.min(press.maxPrintableWidthMm, physicalAvailableWidth);
  const leadingMargin = base.leadingPlateMarginMm ?? 0;
  const trailingMargin = base.trailingPlateMarginMm ?? 0;

  for (const rotation of (allowRotation ? [0, 90] : [0]) as (0 | 90)[]) {
    const effectiveWidth = rotation === 90 ? base.label.lengthMm : base.label.widthMm;
    const effectiveLength = rotation === 90 ? base.label.widthMm : base.label.lengthMm;
    const acrossPitch = effectiveWidth + base.layout.gapAcrossMm;
    const aroundPitch = effectiveLength + base.layout.gapAroundMm;
    const maximumLabelsAcross = acrossPitch > 0 ? Math.floor((availableWidthMm + base.layout.gapAcrossMm) / acrossPitch) : 0;
    const availablePlateLength = cylinder ? cylinder.recommendedMaxPlateLengthMm - leadingMargin - trailingMargin : press.maxPrintRepeatMm - leadingMargin - trailingMargin;
    const maximumLabelsAround = aroundPitch > 0 ? Math.floor((availablePlateLength + base.layout.gapAroundMm) / aroundPitch) : 0;
    const acrossSearchLimit = Math.max(0, Math.min(maximumLabelsAcross, defensiveCap));
    const aroundSearchLimit = Math.max(0, Math.min(maximumLabelsAround, defensiveCap));

    for (let across = 1; across <= acrossSearchLimit; across += 1) {
      for (let around = 1; around <= aroundSearchLimit; around += 1) {
        const candidate = { ...base, label: { ...base.label, rotationDegrees: rotation }, layout: { ...base.layout, labelsAcross: across, labelsAround: around } };
        const calc = calculateLayout(candidate, press, finisher);
        if (calc.errors.length === 0) {
          options.push({
            rotation,
            labelsAcross: across,
            labelsAround: around,
            occupiedWidthMm: calc.occupiedWidthMm,
            occupiedLabelLengthMm: calc.occupiedLabelLengthMm,
            plateRepeatMm: calc.plateRepeatMm,
            total: calc.totalLabelsPerRepeat,
            widthUse: calc.pressWidthUtilizationPercent,
            reason: `${calc.totalLabelsPerRepeat} labels; ${calc.pressWidthUtilizationPercent.toFixed(1)}% width use; ${calc.plateRepeatMm.toFixed(1)} mm plate repeat; ${rotation === 90 ? "rotated" : "standard"} orientation.`,
          });
        }
      }
    }
  }
  return options.sort((a, b) => b.total - a.total || b.widthUse - a.widthUse || a.plateRepeatMm - b.plateRepeatMm).slice(0, 8);
}
