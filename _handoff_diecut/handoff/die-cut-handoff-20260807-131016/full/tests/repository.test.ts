import test from "node:test";
import assert from "node:assert/strict";
import { canAutosave, exportState, hydrateState, importState, loadState, resetSavedState, STORAGE_KEY, cloneSeed, sampleDie } from "../src/die-cut-engine/index.ts";

function withStorage(initial: string | null, run: (storage: { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void; removeItem: (key: string) => void; value: () => string | null; writes: () => number }) => void) {
  let stored = initial; let writeCount = 0;
  const storage = { getItem: (key: string) => key === STORAGE_KEY ? stored : null, setItem: (key: string, value: string) => { if (key === STORAGE_KEY) { stored = value; writeCount += 1; } }, removeItem: (key: string) => { if (key === STORAGE_KEY) stored = null; }, value: () => stored, writes: () => writeCount };
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: storage } });
  try { run(storage); } finally { Reflect.deleteProperty(globalThis, "window"); }
}

test("empty die imports are rejected", () => {
  assert.throws(() => importState(JSON.stringify({ schemaVersion: 1, dieSpecifications: [] }), cloneSeed()), /at least one die/i);
});

test("malformed die imports are rejected with a useful error", () => {
  assert.throws(() => importState(JSON.stringify({ schemaVersion: 1, dieSpecifications: [{ id: "broken" }] }), cloneSeed()), /valid ID and name/i);
});

test("legacy options are normalized to the supported production workflow", () => {
  const legacy = structuredClone(sampleDie);
  legacy.dieCutMode = "fullRotary";
  legacy.layout.staggered = true;
  legacy.layout.staggerOffsetMm = 12;
  legacy.distortionFactor = 0.97;
  legacy.distortionAxis = "around";
  legacy.distortionResponsibility = "supplierToApply";
  legacy.cuttingMarginMm = 5;
  legacy.cuttingMarginMode = "includedInPlateDimensions";
  legacy.cuttingMarginConfirmed = false;
  delete legacy.leadingPlateMarginMm;
  delete legacy.trailingPlateMarginMm;
  delete (legacy as Partial<typeof legacy>).plateMarginsVerification;
  delete legacy.plateMarginsConfirmed;
  const imported = importState(JSON.stringify({ schemaVersion: 1, dieSpecifications: [legacy] }), cloneSeed());
  assert.equal(imported.dieSpecifications[0].dieCutMode, "semiRotary");
  assert.equal(imported.dieSpecifications[0].layout.staggered, false);
  assert.equal(imported.dieSpecifications[0].layout.staggerOffsetMm, undefined);
  assert.equal(imported.dieSpecifications[0].distortionFactor, 1);
  assert.equal(imported.dieSpecifications[0].distortionAxis, "none");
  assert.equal(imported.dieSpecifications[0].leadingPlateMarginMm, 0);
  assert.equal(imported.dieSpecifications[0].trailingPlateMarginMm, 0);
  assert.equal(imported.dieSpecifications[0].plateMarginsVerification, "unknown");
  assert.equal(imported.dieSpecifications[0].cuttingMarginMm, 10);
  assert.equal(imported.dieSpecifications[0].cuttingMarginMode, "outsideLayout");
  assert.equal(imported.dieSpecifications[0].cuttingMarginConfirmed, true);
});

test("legacy booleans migrate conservatively to explicit verification states", () => {
  const legacy = structuredClone(sampleDie);
  delete (legacy as Partial<typeof legacy>).plateMarginsVerification;
  delete (legacy as Partial<typeof legacy>).physicalWebVerification;
  legacy.plateMarginsConfirmed = true;
  legacy.physicalWebConfirmed = true;
  const imported = importState(JSON.stringify({ schemaVersion: 1, dieSpecifications: [legacy] }), cloneSeed());
  assert.equal(imported.dieSpecifications[0].plateMarginsVerification, "unknown");
  assert.equal(imported.dieSpecifications[0].physicalWebVerification, "confirmed");
});

test("legacy persisted 200Z cylinder receives documented plate limits", () => {
  const legacyState = cloneSeed();
  const legacyCylinder = legacyState.finisherProfiles[0].cylinders[0] as unknown as Record<string, unknown>;
  Reflect.deleteProperty(legacyCylinder, "recommendedMinPlateLengthMm");
  Reflect.deleteProperty(legacyCylinder, "recommendedMaxPlateLengthMm");
  Reflect.deleteProperty(legacyCylinder, "machineSoftwareMaxPlateLengthMm");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: { getItem: () => JSON.stringify(legacyState) } } });
  try {
    const loaded = loadState();
    const cylinder = loaded.finisherProfiles[0].cylinders[0];
    assert.equal(cylinder.recommendedMinPlateLengthMm, 190.5);
    assert.equal(cylinder.recommendedMaxPlateLengthMm, 520.7);
    assert.equal(cylinder.machineSoftwareMaxPlateLengthMm, 558.8);
  } finally {
    Reflect.deleteProperty(globalThis, "window");
  }
});

test("circle imports use one diameter and a derived radius", () => {
  const circle = structuredClone(sampleDie);
  circle.label.shape = "circle";
  circle.label.widthMm = 50;
  circle.label.lengthMm = 70;
  const imported = importState(JSON.stringify({ schemaVersion: 1, dieSpecifications: [circle] }), cloneSeed());
  assert.equal(imported.dieSpecifications[0].label.widthMm, 50);
  assert.equal(imported.dieSpecifications[0].label.lengthMm, 50);
  assert.equal(imported.dieSpecifications[0].label.cornerRadiusMm, 25);
});

test("negative imported cutting margin is rejected", () => {
  const invalid = structuredClone(sampleDie); invalid.cuttingMarginMm = -10;
  assert.throws(() => importState(JSON.stringify({ schemaVersion: 1, dieSpecifications: [invalid] }), cloneSeed()), /invalid cutting plate margin/i);
});

test("export and import roundtrip machine profiles and active die", () => {
  const state = cloneSeed();
  state.pressProfiles[0].maxPrintableWidthMm = 320;
  state.finisherProfiles[0].sensorCheckRequiredForReview = false;
  const second = structuredClone(state.dieSpecifications[0]);
  second.id = "die-second";
  second.name = "Second";
  state.dieSpecifications.push(second);
  state.activeDieId = second.id;
  const imported = importState(exportState(state), cloneSeed());
  assert.equal(imported.pressProfiles[0].maxPrintableWidthMm, 320);
  assert.equal(imported.finisherProfiles[0].sensorCheckRequiredForReview, false);
  assert.equal(imported.activeDieId, second.id);
});

test("legacy machineProfiles exports still hydrate machine profile edits", () => {
  const state = cloneSeed();
  state.pressProfiles[0].maxPrintRepeatMm = 990;
  state.finisherProfiles[0].registrationMarkCheckRequiredForReview = false;
  const legacyPayload = JSON.stringify({
    schemaVersion: 1,
    machineProfiles: [...state.pressProfiles, ...state.finisherProfiles],
    dieSpecifications: state.dieSpecifications,
  });
  const imported = importState(legacyPayload, cloneSeed());
  assert.equal(imported.pressProfiles[0].maxPrintRepeatMm, 990);
  assert.equal(imported.finisherProfiles[0].registrationMarkCheckRequiredForReview, false);
});

test("malformed stored JSON enters recovery without changing the original", () => {
  withStorage('{"broken":', (storage) => {
    const result = hydrateState();
    assert.equal(result.status, "recoveryRequired");
    assert.equal(result.status === "recoveryRequired" ? result.recovery.rawPayload : "", '{"broken":');
    assert.equal(storage.value(), '{"broken":');
    assert.equal(storage.writes(), 0);
  });
});

test("schema-invalid stored JSON enters recovery without writing sample data", () => {
  const raw = JSON.stringify({ schemaVersion: 1, dieSpecifications: [] });
  withStorage(raw, (storage) => {
    const result = hydrateState();
    assert.equal(result.status, "recoveryRequired");
    assert.equal(storage.value(), raw);
    assert.equal(storage.writes(), 0);
  });
});

test("autosave interlock blocks loading, empty, and recovery states", () => {
  assert.equal(canAutosave("loading"), false);
  assert.equal(canAutosave("empty"), false);
  assert.equal(canAutosave("recoveryRequired"), false);
  assert.equal(canAutosave("valid"), true);
  assert.equal(canAutosave("valid", true), false);
});

test("valid stored data hydrates normally", () => {
  const raw = JSON.stringify(cloneSeed());
  withStorage(raw, (storage) => {
    const result = hydrateState();
    assert.equal(result.status, "valid");
    assert.equal(result.status === "valid" ? result.state.activeDieId : "", sampleDie.id);
    assert.equal(storage.writes(), 0);
  });
});

test("empty storage loads sample state without recovery or automatic write", () => {
  withStorage(null, (storage) => {
    const result = hydrateState();
    assert.equal(result.status, "empty");
    assert.equal(result.status === "empty" ? result.state.activeDieId : "", sampleDie.id);
    assert.equal(storage.value(), null);
    assert.equal(storage.writes(), 0);
  });
});

test("explicit reset removes stored data", () => {
  withStorage('{"broken":', (storage) => {
    resetSavedState();
    assert.equal(storage.value(), null);
  });
});
