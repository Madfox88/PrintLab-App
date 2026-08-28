import test from "node:test";
import assert from "node:assert/strict";
import { calculateLayout, optimizeLayouts, circumferenceFromTeeth, parseLocalizedNumber, finisherProfile, pressProfile, sampleDie } from "../src/die-cut-engine/index.ts";

const die = () => structuredClone(sampleDie);

test("verified sample occupies 308 mm with 9 mm remaining and 4.5 mm centered", () => {
  const result = calculateLayout(die(), pressProfile, finisherProfile);
  assert.equal(result.occupiedWidthMm, 308);
  assert.equal(result.widthRemainingMm, 9);
  assert.equal(result.leftOffsetMm, 4.5);
  assert.equal(result.rightOffsetMm, 4.5);
  assert.equal(result.totalLabelsPerRepeat, 6);
});

test("200Z nominal circumference is exactly 635 mm", () => {
  assert.equal(circumferenceFromTeeth(200), 635);
});

test("excessive width fails by 33 mm", () => {
  const value = die(); value.label.widthMm = 55;
  const result = calculateLayout(value, pressProfile, finisherProfile);
  assert.equal(result.occupiedWidthMm, 350);
  assert.equal(result.widthRemainingMm, -33);
  assert.equal(result.fitsPressWidth, false);
});

test("one label adds no unnecessary gap", () => {
  const value = die(); value.layout.labelsAcross = 1;
  assert.equal(calculateLayout(value, pressProfile, finisherProfile).occupiedWidthMm, 48);
});

test("rotation swaps effective dimensions", () => {
  const value = die(); value.label.rotationDegrees = 90;
  const result = calculateLayout(value, pressProfile, finisherProfile);
  assert.equal(result.effectiveLabelWidthMm, 196);
  assert.equal(result.effectiveLabelLengthMm, 48);
});

test("full rotary rejects repeat beyond certified 635 mm", () => {
  const value = die(); value.dieCutMode = "fullRotary"; value.layout.labelsAround = 4;
  const result = calculateLayout(value, pressProfile, finisherProfile);
  assert.equal(result.fitsCylinderCircumference, false);
  assert.ok(result.errors.some((error) => error.id === "cylinder-fit"));
});

test("exact press-width fit passes", () => {
  const value = die(); value.layout.labelsAcross = 1; value.label.widthMm = 317; value.layout.gapAcrossMm = 0;
  const result = calculateLayout(value, pressProfile, finisherProfile);
  assert.equal(result.widthRemainingMm, 0);
  assert.equal(result.fitsPressWidth, true);
});

test("invalid dimensions, gaps and counts are rejected", () => {
  const value = die(); value.label.widthMm = 0; value.layout.labelsAcross = 1.5; value.layout.gapAroundMm = -1;
  const result = calculateLayout(value, pressProfile, finisherProfile);
  assert.ok(result.errors.some((error) => error.id === "label-dimensions"));
  assert.ok(result.errors.some((error) => error.id === "layout-counts"));
  assert.ok(result.errors.some((error) => error.id === "negative-gap"));
});

test("508 mm plate repeat passes the recommended 520.7 mm maximum", () => {
  const value = die();
  value.label.widthMm = 65; value.label.lengthMm = 60;
  value.layout.labelsAcross = 4; value.layout.labelsAround = 8;
  value.layout.gapAcrossMm = 4; value.layout.gapAroundMm = 4;
  const result = calculateLayout(value, pressProfile, finisherProfile);
  assert.equal(result.occupiedWidthMm, 272);
  assert.equal(result.widthRemainingMm, 45);
  assert.equal(result.leftOffsetMm, 22.5);
  assert.equal(result.occupiedLabelLengthMm, 508);
  assert.equal(result.plateRepeatMm, 508);
  assert.equal(result.recommendedMaximumPlateLengthMm, 520.7);
  assert.ok(Math.abs((result.plateRepeatRemainingMm ?? 0) - 12.7) < 1e-9);
  assert.equal(result.maximumLabelsAround, 8);
  assert.equal(result.fitsSemiRotaryPlateLength, true);
});

test("a 520.7 mm registration pitch passes exactly", () => {
  const value = die(); value.registrationMarkPitchMm = 520.7;
  const result = calculateLayout(value, pressProfile, finisherProfile);
  assert.equal(result.plateRepeatMm, 520.7);
  assert.equal(result.fitsSemiRotaryPlateLength, true);
  assert.ok(!result.errors.some((error) => error.id === "PLATE_REPEAT_EXCEEDS_RECOMMENDED_MAXIMUM"));
});

test("a value slightly above 520.7 mm is blocked", () => {
  const value = die(); value.registrationMarkPitchMm = 520.71;
  const result = calculateLayout(value, pressProfile, finisherProfile);
  assert.equal(result.fitsSemiRotaryPlateLength, false);
  assert.ok(result.errors.some((error) => error.id === "PLATE_REPEAT_EXCEEDS_RECOMMENDED_MAXIMUM"));
});

test("a value below the recommended 190.5 mm minimum is blocked", () => {
  const value = die(); value.label.lengthMm = 190.4;
  const result = calculateLayout(value, pressProfile, finisherProfile);
  assert.ok(result.errors.some((error) => error.id === "PLATE_REPEAT_BELOW_RECOMMENDED_MINIMUM"));
});

test("nine labels around is the first invalid count for 60 mm labels with 4 mm gaps", () => {
  const value = die(); value.label.widthMm = 65; value.label.lengthMm = 60; value.layout.labelsAcross = 4; value.layout.labelsAround = 9; value.layout.gapAcrossMm = 4; value.layout.gapAroundMm = 4;
  const result = calculateLayout(value, pressProfile, finisherProfile);
  assert.equal(result.plateRepeatMm, 572);
  const error = result.errors.find((item) => item.id === "PLATE_REPEAT_EXCEEDS_RECOMMENDED_MAXIMUM");
  assert.ok(error);
  assert.match(error.detail, /51\.3 mm/);
});

test("optimizer rediscovers an eight-around valid layout and returns no blocking candidates", () => {
  const value = die(); value.label.widthMm = 65; value.label.lengthMm = 60; value.layout.gapAcrossMm = 4; value.layout.gapAroundMm = 4;
  const options = optimizeLayouts(value, pressProfile, finisherProfile);
  assert.ok(options.some((option) => option.labelsAround === 8));
  for (const option of options) {
    const candidate = structuredClone(value); candidate.label.rotationDegrees = option.rotation; candidate.layout.labelsAcross = option.labelsAcross; candidate.layout.labelsAround = option.labelsAround;
    assert.equal(calculateLayout(candidate, pressProfile, finisherProfile).errors.length, 0);
  }
});

test("leading and trailing margins contribute to plate repeat", () => {
  const value = die(); value.leadingPlateMarginMm = 10; value.trailingPlateMarginMm = 12;
  const result = calculateLayout(value, pressProfile, finisherProfile);
  assert.equal(result.occupiedLabelLengthMm, 196);
  assert.equal(result.plateRepeatMm, 218);
});

test("cut geometry extending beyond registration pitch is blocked", () => {
  const value = die(); value.leadingPlateMarginMm = 10; value.trailingPlateMarginMm = 12; value.registrationMarkPitchMm = 200;
  const result = calculateLayout(value, pressProfile, finisherProfile);
  assert.ok(result.errors.some((error) => error.id === "PLATE_GEOMETRY_EXCEEDS_REPEAT"));
});

test("physical web validation is separate from printable width", () => {
  const value = die(); value.webWidthMm = 315; value.requiredLeftEdgeMarginMm = 5; value.requiredRightEdgeMarginMm = 5; value.physicalWebVerification = "confirmed";
  const result = calculateLayout(value, pressProfile, finisherProfile);
  assert.equal(result.fitsPressWidth, true);
  assert.equal(result.fitsPhysicalWebWidth, false);
  assert.ok(result.errors.some((error) => error.id === "PHYSICAL_WEB_WIDTH_EXCEEDED"));
});

test("unknown cut-position spacing warns until confirmed or not required", () => {
  const value = die();
  assert.ok(calculateLayout(value, pressProfile, finisherProfile).warnings.some((warning) => warning.id === "PLATE_MARGINS_REQUIRE_VERIFICATION"));
  value.plateMarginsVerification = "confirmed";
  assert.ok(!calculateLayout(value, pressProfile, finisherProfile).warnings.some((warning) => warning.id === "PLATE_MARGINS_REQUIRE_VERIFICATION"));
  value.plateMarginsVerification = "notRequired";
  assert.ok(!calculateLayout(value, pressProfile, finisherProfile).warnings.some((warning) => warning.id === "PLATE_MARGINS_REQUIRE_VERIFICATION"));
});

test("editing confirmed cut-position spacing returns it to unknown", () => {
  const value = die();
  value.plateMarginsVerification = "confirmed";
  value.leadingPlateMarginMm = 1;
  value.plateMarginsVerification = "unknown";
  assert.ok(calculateLayout(value, pressProfile, finisherProfile).warnings.some((warning) => warning.id === "PLATE_MARGINS_REQUIRE_VERIFICATION"));
});

test("missing physical web data warns only when the finisher policy requires it", () => {
  const value = die();
  assert.ok(calculateLayout(value, pressProfile, finisherProfile).warnings.some((warning) => warning.id === "PHYSICAL_WEB_DATA_REQUIRES_VERIFICATION"));
  const optionalProfile = structuredClone(finisherProfile);
  optionalProfile.physicalWebCheckRequiredForOrdering = false;
  assert.ok(!calculateLayout(value, pressProfile, optionalProfile).warnings.some((warning) => warning.id === "PHYSICAL_WEB_DATA_REQUIRES_VERIFICATION"));
});

test("known physical-web failure remains a geometry error even when profile review is optional", () => {
  const value = die();
  value.webWidthMm = 315; value.requiredLeftEdgeMarginMm = 5; value.requiredRightEdgeMarginMm = 5;
  const optionalProfile = structuredClone(finisherProfile);
  optionalProfile.physicalWebCheckRequiredForOrdering = false;
  assert.ok(calculateLayout(value, pressProfile, optionalProfile).errors.some((error) => error.id === "PHYSICAL_WEB_WIDTH_EXCEEDED"));
});

test("negative cutting margin is blocking and cannot reduce accepted plate dimensions", () => {
  const value = die();
  value.cuttingMarginMm = -10;
  const result = calculateLayout(value, pressProfile, finisherProfile);
  assert.ok(result.errors.some((error) => error.id === "cutting-margin-negative"));
  assert.equal(result.status, "invalid");
  assert.equal(result.requiredPlateWidthMm, result.occupiedWidthMm + 20);
  assert.equal(result.requiredPlateLengthMm, result.occupiedLabelLengthMm + 20);
});

test("cutting plate margin is fixed at 10 mm on every side", () => {
  const value = die();
  value.cuttingMarginMm = 5;
  const result = calculateLayout(value, pressProfile, finisherProfile);
  assert.ok(result.errors.some((error) => error.id === "cutting-margin-not-fixed"));
  assert.equal(result.requiredPlateWidthMm, result.occupiedWidthMm + 20);
  assert.equal(result.requiredPlateLengthMm, result.occupiedLabelLengthMm + 20);
});

test("negative leading and trailing cut-position spacing are blocking", () => {
  const leading = die(); leading.leadingPlateMarginMm = -10;
  const trailing = die(); trailing.trailingPlateMarginMm = -10;
  assert.ok(calculateLayout(leading, pressProfile, finisherProfile).errors.some((error) => error.id === "plate-margin-negative"));
  assert.ok(calculateLayout(trailing, pressProfile, finisherProfile).errors.some((error) => error.id === "plate-margin-negative"));
  assert.equal(calculateLayout(leading, pressProfile, finisherProfile).plateRepeatMm, leading.label.lengthMm);
});

test("negative physical edge margin is blocking and does not reduce required width", () => {
  const value = die();
  value.webWidthMm = 330; value.requiredLeftEdgeMarginMm = -10; value.requiredRightEdgeMarginMm = 5;
  const result = calculateLayout(value, pressProfile, finisherProfile);
  assert.ok(result.errors.some((error) => error.id === "edge-margin-invalid"));
  assert.equal(result.physicalWebRequiredWidthMm, result.occupiedWidthMm + 5);
});

test("optimizer rejects a base design with negative production dimensions", () => {
  const value = die(); value.cuttingMarginMm = -10;
  assert.deepEqual(optimizeLayouts(value, pressProfile, finisherProfile), []);
});

test("nominal and certified circumference mismatch creates a warning", () => {
  const alteredFinisher = structuredClone(finisherProfile);
  alteredFinisher.cylinders[0].certifiedCircumferenceMm = 634;
  const result = calculateLayout(die(), pressProfile, alteredFinisher);
  assert.ok(result.warnings.some((warning) => warning.id === "CYLINDER_NOMINAL_CERTIFIED_MISMATCH"));
});

test("decimal comma and point normalize equally", () => {
  assert.equal(parseLocalizedNumber("48,0"), parseLocalizedNumber("48.0"));
});

test("circle geometry requires one shared diameter", () => {
  const value = die(); value.label.shape = "circle"; value.label.widthMm = 50; value.label.lengthMm = 60;
  const result = calculateLayout(value, pressProfile, finisherProfile);
  assert.ok(result.errors.some((error) => error.id === "circle-diameter"));
});

test("sample serializes without changing values", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(sampleDie)), sampleDie);
});
