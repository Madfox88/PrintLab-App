import test from "node:test";
import assert from "node:assert/strict";
import { calculateLayout, evaluateSpecificationChecklist, exportPurchaseCsv, findReusableDies, formatDanishPurchaseText, formatPurchaseText, generatePurchaseSpecification, getPurchaseExportPolicy, invalidateApprovedPurchase, purchaseCertificateFields, circumferenceFromTeeth, finisherProfile, pressProfile, sampleDie } from "../src/die-cut-engine/index.ts";

const build = () => {
  const die = structuredClone(sampleDie);
  const calc = calculateLayout(die, pressProfile, finisherProfile);
  return { die, spec: generatePurchaseSpecification(die, calc, pressProfile, finisherProfile, finisherProfile.cylinders[0]) };
};

const completeRequired = (die = structuredClone(sampleDie)) => {
  die.cuttingMarginConfirmed = true;
  die.plateMarginsVerification = "confirmed";
  die.registrationRequirementsVerification = "confirmed";
  die.sensorRequirementsVerification = "confirmed";
  die.webWidthMm = 330;
  die.requiredLeftEdgeMarginMm = 5;
  die.requiredRightEdgeMarginMm = 5;
  die.physicalWebVerification = "confirmed";
  die.certificate.referenceFile = "approved-dieline.pdf";
  return die;
};

test("sample purchase calculation uses four-sided margin", () => {
  const { spec } = build();
  assert.equal(spec.layout.occupiedWidthMm, 308);
  assert.equal(spec.layout.occupiedLengthMm, 196);
  assert.equal(spec.plate.requiredPlateWidthMm, 328);
  assert.equal(spec.plate.requiredPlateLengthMm, 216);
});

test("fixed plate margin is complete without supplier confirmation", () => {
  const { spec } = build();
  const margin = spec.checklist.find((entry) => entry.id === "cutting-margin");
  assert.equal(margin?.complete, true);
  assert.equal(margin?.label, "Fixed 10 mm plate margin applied on every side");
  assert.equal(spec.plate.cuttingMarginMm, 10);
  assert.ok(spec.supplierQuestions.every((question) => !question.includes("cutting margin")));
});

test("missing registration requires verification", () => {
  const { spec } = build();
  assert.ok(spec.missingInformation.includes("Registration-mark requirements require confirmation"));
  assert.equal(spec.status, "requiresMachineVerification");
});

test("identical saved die is an exact reuse match", () => {
  const proposed = structuredClone(sampleDie); proposed.id = "proposed";
  const matches = findReusableDies(proposed, [sampleDie]);
  assert.equal(matches[0]?.status, "exact");
});

test("geometry change increments revision and invalidates approval", () => {
  const { spec } = build(); spec.status = "readyForHumanReview"; spec.approvals.purchasingApprovedBy = "Operator";
  const changed = invalidateApprovedPurchase(spec, ["label width"]);
  assert.equal(changed.revision, spec.revision + 1);
  assert.equal(changed.status, "requiresMachineVerification");
  assert.equal(changed.approvals.purchasingApprovedBy, undefined);
});

test("purchase output uses certified 635.0 mm circumference", () => {
  const { spec } = build();
  assert.equal(spec.cylinder.certifiedCircumferenceMm, 635);
  assert.equal(circumferenceFromTeeth(finisherProfile.cylinders[0].teeth), 635);
  assert.equal(spec.cylinder.recommendedMaxPlateLengthMm, 520.7);
});

test("supplier purchase output contains only the requested certificate geometry", () => {
  const { spec } = build();
  const fields = purchaseCertificateFields(spec);
  assert.deepEqual(Object.keys(fields), ["circumferenceMm", "cylinderTeethModule", "labelsAcross", "labelsAround", "labelWidthMm", "labelLengthMm", "labelDiameterMm", "gapAcrossMm", "gapMachineDirectionMm", "radiusMm", "plateRepeatMm"]);
  assert.equal(fields.circumferenceMm, 635);
  assert.equal(fields.cylinderTeethModule, 200);
  assert.equal(fields.labelDiameterMm, null);
  assert.equal(fields.gapMachineDirectionMm, null);
  const text = formatPurchaseText(spec);
  assert.match(text, /Circumference: 635\.0 mm/);
  assert.match(text, /Plate repeat: 196\.0 mm/);
  assert.doesNotMatch(text, /Customer|Machine:|Material|Readiness|Supplier/);
  const csv = exportPurchaseCsv(spec);
  assert.doesNotMatch(csv, /Supplier|Material|Purchase Readiness|Plate Width/);
});

test("label length is always machine direction and width is always across", () => {
  const die = structuredClone(sampleDie);
  die.label.rotationDegrees = 90;
  die.layout.labelsAcross = 1;
  const calc = calculateLayout(die, pressProfile, finisherProfile);
  const spec = generatePurchaseSpecification(die, calc, pressProfile, finisherProfile, finisherProfile.cylinders[0]);
  const fields = purchaseCertificateFields(spec);
  assert.equal(fields.labelWidthMm, 196);
  assert.equal(fields.labelLengthMm, 48);
});

test("circle purchase fields expose diameter and derived radius", () => {
  const die = structuredClone(sampleDie);
  die.label.shape = "circle";
  die.label.widthMm = 50;
  die.label.lengthMm = 50;
  die.label.cornerRadiusMm = 25;
  die.layout.labelsAcross = 1;
  const calc = calculateLayout(die, pressProfile, finisherProfile);
  const spec = generatePurchaseSpecification(die, calc, pressProfile, finisherProfile, finisherProfile.cylinders[0]);
  const fields = purchaseCertificateFields(spec);
  assert.equal(fields.labelDiameterMm, 50);
  assert.equal(fields.radiusMm, 25);
});

test("purchase uses exactly the central calculation plate repeat", () => {
  const die = structuredClone(sampleDie);
  die.leadingPlateMarginMm = 5;
  die.trailingPlateMarginMm = 7;
  const calc = calculateLayout(die, pressProfile, finisherProfile);
  const spec = generatePurchaseSpecification(die, calc, pressProfile, finisherProfile, finisherProfile.cylinders[0]);
  assert.equal(calc.plateRepeatMm, 208);
  assert.equal(spec.plate.cuttingRepeatMm, calc.plateRepeatMm);
  assert.equal(purchaseCertificateFields(spec).plateRepeatMm, calc.plateRepeatMm);
});

test("invalid geometry blocks every purchase export", () => {
  const die = structuredClone(sampleDie);
  die.label.lengthMm = 60;
  die.layout.labelsAround = 9;
  die.layout.gapAroundMm = 4;
  const calc = calculateLayout(die, pressProfile, finisherProfile);
  const spec = generatePurchaseSpecification(die, calc, pressProfile, finisherProfile, finisherProfile.cylinders[0]);
  const policy = getPurchaseExportPolicy(spec);
  assert.ok(calc.errors.some((error) => error.id === "PLATE_REPEAT_EXCEEDS_RECOMMENDED_MAXIMUM"));
  assert.equal(policy.blocked, true);
  assert.equal(policy.documentLabel, "INVALID PURCHASE SPECIFICATION");
});

test("machine and supplier verification permit only visibly marked drafts", () => {
  const { die, spec } = build();
  assert.equal(getPurchaseExportPolicy(spec).blocked, false);
  assert.equal(spec.status, "requiresMachineVerification");
  assert.equal(getPurchaseExportPolicy(spec).documentLabel, "DRAFT — REQUIRES MACHINE VERIFICATION");
  die.plateMarginsVerification = "confirmed";
  die.registrationRequirementsVerification = "confirmed";
  die.sensorRequirementsVerification = "confirmed";
  let calc = calculateLayout(die, pressProfile, finisherProfile);
  const supplierReview = generatePurchaseSpecification(die, calc, pressProfile, finisherProfile, finisherProfile.cylinders[0]);
  let policy = getPurchaseExportPolicy(supplierReview);
  assert.equal(supplierReview.status, "requiresSupplierReview");
  assert.equal(policy.blocked, false);
  assert.equal(policy.draft, true);
  assert.equal(policy.documentLabel, "DRAFT PURCHASE SPECIFICATION — REQUIRES HUMAN REVIEW");
  die.webWidthMm = 330;
  die.requiredLeftEdgeMarginMm = 5;
  die.requiredRightEdgeMarginMm = 5;
  die.physicalWebVerification = "confirmed";
  die.certificate.referenceFile = "approved-dieline.pdf";
  calc = calculateLayout(die, pressProfile, finisherProfile);
  const completedCritical = generatePurchaseSpecification(die, calc, pressProfile, finisherProfile, finisherProfile.cylinders[0]);
  policy = getPurchaseExportPolicy(completedCritical);
  assert.equal(completedCritical.status, "readyForHumanReview");
  assert.equal(policy.blocked, false);
  assert.equal(policy.draft, false);
  assert.equal(policy.documentLabel, "PURCHASE SPECIFICATION — READY FOR HUMAN REVIEW");
});

test("profile can explicitly make the physical-web order check unnecessary", () => {
  const die = completeRequired();
  const finisher = structuredClone(finisherProfile);
  finisher.physicalWebCheckRequiredForOrdering = false;
  const calc = calculateLayout(die, pressProfile, finisher);
  const spec = generatePurchaseSpecification(die, calc, pressProfile, finisher, finisher.cylinders[0]);
  assert.equal(spec.status, "readyForHumanReview");
  assert.equal(spec.checklist.find((entry) => entry.id === "physical-web")?.required, false);
  assert.equal(getPurchaseExportPolicy(spec).documentLabel, "PURCHASE SPECIFICATION — READY FOR HUMAN REVIEW");
});

test("valid geometry with incomplete required checks is not ready for human review", () => {
  const die = structuredClone(sampleDie);
  const calc = calculateLayout(die, pressProfile, finisherProfile);
  const evaluation = evaluateSpecificationChecklist(die, calc, pressProfile, finisherProfile, finisherProfile.cylinders[0]);
  assert.equal(calc.errors.length, 0);
  assert.equal(evaluation.status, "requiresMachineVerification");
  assert.ok(evaluation.incompleteRequired.length > 0);
});

test("all required checklist items complete is ready for human review", () => {
  const die = completeRequired();
  const calc = calculateLayout(die, pressProfile, finisherProfile);
  const spec = generatePurchaseSpecification(die, calc, pressProfile, finisherProfile, finisherProfile.cylinders[0]);
  assert.equal(spec.status, "readyForHumanReview");
  assert.equal(spec.checklist.filter((entry) => entry.required && !entry.complete).length, 0);
  assert.equal(getPurchaseExportPolicy(spec).unqualifiedSpecification, true);
});

test("optional incomplete checklist items do not block human-review readiness", () => {
  const die = completeRequired();
  die.tolerancesVerification = "unknown";
  die.operatorReviewVerification = "unknown";
  die.certificate.notes = "";
  const calc = calculateLayout(die, pressProfile, finisherProfile);
  const spec = generatePurchaseSpecification(die, calc, pressProfile, finisherProfile, finisherProfile.cylinders[0]);
  assert.equal(spec.checklist.find((entry) => entry.id === "tolerances")?.required, false);
  assert.equal(spec.status, "readyForHumanReview");
});

test("generator and UI-facing specification consume the same central checklist", () => {
  const die = structuredClone(sampleDie);
  const calc = calculateLayout(die, pressProfile, finisherProfile);
  const central = evaluateSpecificationChecklist(die, calc, pressProfile, finisherProfile, finisherProfile.cylinders[0]);
  const spec = generatePurchaseSpecification(die, calc, pressProfile, finisherProfile, finisherProfile.cylinders[0]);
  assert.deepEqual(spec.checklist, central.items);
  assert.equal(spec.status, central.status);
  assert.equal(spec.missingInformation.length, central.incompleteRequired.length);
});

test("cut-position wording is derived from the same verification state", () => {
  const die = structuredClone(sampleDie);
  let calc = calculateLayout(die, pressProfile, finisherProfile);
  let item = evaluateSpecificationChecklist(die, calc, pressProfile, finisherProfile, finisherProfile.cylinders[0]).items.find((entry) => entry.id === "cut-position-spacing");
  assert.equal(item?.label, "Cut-position spacing requires confirmation");
  assert.equal(item?.complete, false);
  die.plateMarginsVerification = "confirmed";
  calc = calculateLayout(die, pressProfile, finisherProfile);
  item = evaluateSpecificationChecklist(die, calc, pressProfile, finisherProfile, finisherProfile.cylinders[0]).items.find((entry) => entry.id === "cut-position-spacing");
  assert.equal(item?.label, "Cut-position spacing confirmed");
  assert.equal(item?.complete, true);
});

test("purchase generation cannot bypass a negative cutting-margin geometry error", () => {
  const die = completeRequired();
  die.cuttingMarginMm = -10;
  const calc = calculateLayout(die, pressProfile, finisherProfile);
  const spec = generatePurchaseSpecification(die, calc, pressProfile, finisherProfile, finisherProfile.cylinders[0]);
  const policy = getPurchaseExportPolicy(spec);
  assert.equal(spec.status, "invalid");
  assert.equal(policy.copy, false);
  assert.equal(policy.draftCsv, false);
  assert.equal(policy.draftJson, false);
  assert.equal(policy.print, false);
});

test("an invalid repeat is never labelled as valid in the checklist", () => {
  const die = structuredClone(sampleDie);
  die.layout.labelsAround = 8;
  const calc = calculateLayout(die, pressProfile, finisherProfile);
  const spec = generatePurchaseSpecification(die, calc, pressProfile, finisherProfile, finisherProfile.cylinders[0]);
  const repeat = spec.checklist.find((entry) => entry.id === "plate-repeat");
  assert.equal(repeat?.complete, false);
  assert.equal(repeat?.label, "Registration-mark pitch is outside the allowed range");
});

test("Danish purchase text is derived from calculator values", () => {
  const die = structuredClone(sampleDie);
  die.certificate.mark = "Kombucha";
  die.certificate.material = "PP UCO White";
  die.certificate.extraTreatment = "Laser";
  die.layout.labelsAcross = 4;
  die.layout.labelsAround = 4;
  die.layout.gapAcrossMm = 4;
  die.layout.gapAroundMm = 4;
  die.label.cornerRadiusMm = 4;
  const calc = calculateLayout(die, pressProfile, finisherProfile);
  const spec = generatePurchaseSpecification(die, calc, pressProfile, finisherProfile, finisherProfile.cylinders[0]);
  const text = formatDanishPurchaseText(spec);
  assert.match(text, /^Størrelse:/);
  assert.match(text, /Etiketbredde: 48,0 mm/);
  assert.match(text, /Etiketlængde: 196,0 mm/);
  assert.match(text, /Antal tværs: 4/);
  assert.match(text, /Antal rundt: 4/);
  assert.match(text, /Afstand tværs: 4 mm/);
  assert.match(text, /Afstand rundt: 4 mm/);
  assert.match(text, /Hjørneradius: 4 mm/);
  assert.match(text, /Mark: Kombucha/);
  assert.match(text, /Med laser hærdning/);
  assert.match(text, /Medie: PP UCO White/);
  assert.doesNotMatch(text, /PURCHASE SPECIFICATION — READY FOR HUMAN REVIEW/);
  assert.doesNotMatch(text, /Pladerepeat:/);
  assert.doesNotMatch(text, /\*\*/);
});
