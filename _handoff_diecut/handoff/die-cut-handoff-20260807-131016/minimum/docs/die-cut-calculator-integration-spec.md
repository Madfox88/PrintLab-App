# Die-Cut Calculator Integration Spec

## Purpose

This module calculates, validates, and prepares supplier-facing die-cut specifications for semi-rotary digital die production. It is intended to be embedded as a functional tab inside a broader multi-product calculator application.

This specification deliberately excludes user-interface requirements. It defines the module in terms of inputs, outputs, rules, state, persistence, and integration behavior.

## Module Role in a Parent Calculator

The parent application hosts multiple product calculators, one tab per product or production workflow. This module provides the die-cut tab's business logic and state model.

The module is responsible for:

- receiving die/job input data;
- calculating layout and machine/cylinder fit;
- validating production constraints;
- producing structured purchase/specification data;
- providing exportable plain-text and structured output;
- persisting and restoring calculator state locally.

The parent application is responsible for:

- tab navigation and shell-level routing;
- shared authentication if any exists;
- global storage policy if the module is wrapped with shared persistence;
- optional cross-tab summaries or badges;
- optional orchestration of save/export workflows.

## Functional Scope

The module supports:

- machine selection;
- semi-rotary cylinder selection;
- label geometry setup;
- step-and-repeat layout setup;
- material and certificate metadata entry;
- geometry validation and production warnings;
- purchase-spec generation;
- plain-text purchase copy generation;
- CSV and JSON export generation;
- local state import/export and recovery.

The module does not support:

- automatic supplier ordering;
- supplier approval workflow;
- email delivery;
- ERP integration;
- multi-user review state;
- server-mandated persistence.

## Core Data Model

Primary domain entities:

- `PressProfile`
- `FinisherProfile`
- `CylinderProfile`
- `DieSpecification`
- `LayoutCalculation`
- `DiePurchaseSpecification`
- `PurchaseExportPolicy`
- `SavedState`

Canonical sources:

- [src/domain/models.ts](src/domain/models.ts)
- [src/domain/calculations.ts](src/domain/calculations.ts)
- [src/domain/purchase.ts](src/domain/purchase.ts)
- [src/data/repository.ts](src/data/repository.ts)

Reusable engine boundary:

- [src/die-cut-engine/index.ts](src/die-cut-engine/index.ts)

Parent-tab contract:

- [src/integration/die-cut-tab-contract.ts](src/integration/die-cut-tab-contract.ts)

## Inputs

### Machine Inputs

Press profile:

- press identifier
- display name
- manufacturer and model
- maximum printable width in mm
- maximum print repeat in mm
- locally verified flag

Finisher profile:

- finisher identifier
- display name
- manufacturer and model
- supported cutting modes
- optional maximum web width
- optional maximum semi-rotary repeat
- default cutting margin rule
- verification-policy flags
- cylinder library

Cylinder profile:

- cylinder identifier
- cylinder name
- tooth count
- certified circumference
- recommended minimum plate length
- recommended maximum plate length
- machine software maximum plate length
- certification metadata

### Job Inputs

Die specification:

- label shape
- label width and length in mm
- corner radius where applicable
- orientation
- labels across
- labels around
- gap across and around
- leading edge to first cut
- final cut to next repeat
- optional registration-mark pitch override
- optional physical web width
- optional physical left and right edge margins
- material metadata
- certificate metadata
- verification states

## Calculation Rules

### Units and Orientation

- All geometry is in millimeters.
- Width is across the web.
- Length is in machine direction.
- Rotation swaps effective width and length for calculation.

### Layout Geometry

Occupied width is calculated from:

- `labelsAcross × effectiveLabelWidthMm`
- plus across gaps between adjacent labels.

Occupied label length is calculated from:

- `labelsAround × effectiveLabelLengthMm`
- plus around gaps between adjacent labels.

### Plate Repeat

Calculated plate repeat is:

- leading plate margin
- plus occupied label length
- plus trailing plate margin.

If `registrationMarkPitchMm` is supplied, that value becomes the authoritative repeat while the calculated repeat remains available for validation and diagnostics.

### Fixed Plate Margin Rule

The cutting plate margin is fixed and non-configurable:

- `10 mm` left
- `10 mm` right
- `10 mm` leading
- `10 mm` trailing

This means:

- required plate width = occupied width + `20 mm`
- required plate length = occupied label length + `20 mm`

This rule is enforced centrally and should not be duplicated inconsistently by the parent application.

### Cylinder and Semi-Rotary Rules

Semi-rotary validation uses the selected cylinder's recommended plate-length range, not the full certified circumference and not only the software maximum.

The certified circumference remains important certificate data but is not treated as the usable semi-rotary plate length.

### Physical Web Rules

Physical web validation is separate from printable width validation.

The module can validate:

- printable-width fit against press limits;
- physical-web fit against web width and left/right edge margins.

These checks must remain logically distinct in any parent integration.

## Validation Rules

The module rejects or warns on, at minimum:

- non-positive label dimensions;
- invalid label counts;
- negative gaps;
- negative leading/trailing cut-position spacing;
- invalid registration-mark pitch;
- invalid circle geometry where width and length differ;
- invalid rounded-rectangle corner radius;
- invalid physical web width;
- invalid physical edge margins;
- cutting margin values that differ from the fixed `10 mm outside layout` rule;
- repeat values outside recommended semi-rotary range;
- cut geometry that exceeds the authoritative repeat;
- physical-web overrun beyond configured allowance.

## Status Model

Purchase/specification status is one of:

- `invalid`
- `requiresMachineVerification`
- `requiresSupplierReview`
- `readyForHumanReview`

Meaning:

- `invalid`: blocking geometry error exists
- `requiresMachineVerification`: geometry is valid but required machine-related review is incomplete
- `requiresSupplierReview`: machine checks are complete but required supplier-review data is incomplete
- `readyForHumanReview`: all required checks are complete, but no order has been placed or approved

These status meanings must be preserved if the module is embedded in a larger tab system.

## Outputs

### Calculation Output

Primary calculation payload includes:

- effective width and length
- occupied width
- occupied label length
- remaining printable width
- plate repeat
- calculated plate repeat
- required plate width and length
- cylinder-related allowances
- fit booleans
- validation errors
- warnings
- informational messages
- overall calculation status

### Purchase Output

Primary purchase/specification payload includes:

- machine context
- cylinder context
- normalized label/layout geometry
- plate geometry
- material/tooling metadata
- warnings and missing information
- supplier questions
- checklist state
- export policy inputs
- purchase specification status

### Export Output

The module can generate:

- plain-text supplier copy
- CSV purchase export
- JSON purchase export
- full-state JSON backup/export

## Persistence and Recovery

Default persistence characteristics:

- browser local storage only
- versioned saved-state schema
- JSON import/export
- explicit malformed-data recovery path

If persisted JSON is malformed or invalid, the module must:

- preserve the original raw payload;
- avoid silently overwriting it;
- expose recovery actions;
- allow reset only by explicit user action.

The parent app must not replace this with silent destructive recovery.

## Integration Contract

The typed parent-tab contract is defined in:

- [src/integration/die-cut-tab-contract.ts](src/integration/die-cut-tab-contract.ts)

The intended contract shape includes:

- parent context
- optional initial state and profile injection
- current calculation output
- current purchase output
- plain-text supplier copy
- dirty-state signal
- blocked-state signal
- export payloads

## Recommended Parent Integration Pattern

Recommended embedding pattern:

1. Parent app activates the die-cut tab.
2. Parent app provides optional seeded machine profiles and saved state.
3. Module owns die-cut-specific calculations and validation.
4. Module emits normalized outputs to parent callbacks.
5. Parent app decides whether to aggregate tab-level status or save actions globally.

The parent app should not reimplement the die-cut business rules outside the engine boundary unless it is also prepared to maintain calculation parity.

## Extraction Boundary

The first reusable-engine boundary is exposed from:

- [src/die-cut-engine/index.ts](src/die-cut-engine/index.ts)

This boundary currently re-exports:

- domain models
- units helpers
- layout calculations
- purchase generation
- persistence helpers
- seed data

This is the initial step toward moving the business logic into a reusable package or shared workspace library.

## Assumptions for Parent Apps

- the module is production-planning support, not an approval system;
- the fixed plate-margin rule remains centralized;
- semi-rotary range validation remains cylinder-profile driven;
- plain-text purchase output is intended for copy/paste workflows;
- storage/import behavior must remain deterministic and recoverable.

## Acceptance Criteria for Embedding

An embedding should be considered correct when:

- identical inputs produce identical calculation outputs;
- validation results match the standalone module;
- purchase status transitions match the standalone module;
- fixed 10 mm plate-margin behavior is preserved;
- import/export payloads remain compatible;
- malformed saved data enters recovery instead of silent overwrite;
- parent-tab orchestration does not change domain semantics.
