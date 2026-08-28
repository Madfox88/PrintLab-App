import type {
  DiePurchaseSpecification,
  DieSpecification,
  FinisherProfile,
  LayoutCalculation,
  PressProfile,
  SavedState,
} from "../die-cut-engine";

export type CalculatorTabId = "dieCut" | string;

export interface ParentCalculatorContext {
  appVersion: string;
  locale: "da-DK" | "en-DK";
  storageNamespace: string;
}

export interface DieCutTabInput {
  initialState?: SavedState;
  initialDie?: DieSpecification;
  pressProfiles?: PressProfile[];
  finisherProfiles?: FinisherProfile[];
}

export interface DieCutTabOutput {
  activeDie: DieSpecification;
  calculation: LayoutCalculation;
  purchaseSpecification: DiePurchaseSpecification;
  plainTextSupplierCopy: string;
  dirty: boolean;
  blocked: boolean;
}

export interface DieCutTabExports {
  state: SavedState;
  purchaseJson: string;
  purchaseCsv: string;
}

export interface DieCutTabCallbacks {
  onChange?: (output: DieCutTabOutput) => void;
  onSave?: (state: SavedState) => void;
  onExport?: (payload: DieCutTabExports) => void;
}

export interface DieCutTabContract {
  id: CalculatorTabId;
  context: ParentCalculatorContext;
  input?: DieCutTabInput;
  callbacks?: DieCutTabCallbacks;
}
