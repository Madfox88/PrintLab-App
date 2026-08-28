import { useMemo } from 'react';
import './DieCutCalculator.css';
import DigitalDieDesigner from '../../features/dieCut/app/DigitalDieDesigner';
import type {
  DieCutTabCallbacks,
  DieCutTabExports,
  DieCutTabInput,
  DieCutTabOutput,
} from '../../features/dieCut/src/integration/die-cut-tab-contract';

interface DieCutCalculatorProps {
  input?: DieCutTabInput;
  onChange?: DieCutTabCallbacks['onChange'];
  onSave?: DieCutTabCallbacks['onSave'];
  onExport?: DieCutTabCallbacks['onExport'];
}

export type { DieCutTabExports, DieCutTabInput, DieCutTabOutput };

export function DieCutCalculator({ input, onChange, onSave, onExport }: DieCutCalculatorProps) {
  const callbacks = useMemo(
    () => ({ onChange, onSave, onExport }),
    [onChange, onSave, onExport]
  );

  return <DigitalDieDesigner input={input} callbacks={callbacks} />;
}