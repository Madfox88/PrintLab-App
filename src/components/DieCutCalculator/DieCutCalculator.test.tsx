// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DieCutCalculator } from './DieCutCalculator';
import { cloneSeed } from '../../features/dieCut/src/die-cut-engine';
import type { SavedState } from '../../features/dieCut/src/die-cut-engine';

function buildReadyStateWithBlockedGeometry(): SavedState {
  const state = cloneSeed();
  const die = state.dieSpecifications[0];

  die.label.lengthMm = 60;
  die.layout.labelsAcross = 4;
  die.layout.labelsAround = 9;
  die.layout.gapAcrossMm = 4;
  die.layout.gapAroundMm = 4;
  die.leadingPlateMarginMm = 0;
  die.trailingPlateMarginMm = 0;
  die.plateMarginsVerification = 'confirmed';
  die.registrationRequirementsVerification = 'confirmed';
  die.sensorRequirementsVerification = 'confirmed';
  die.webWidthMm = 330;
  die.requiredLeftEdgeMarginMm = 5;
  die.requiredRightEdgeMarginMm = 5;
  die.physicalWebVerification = 'confirmed';
  die.certificate.referenceFile = 'approved-dieline.pdf';

  return state;
}

describe('DieCutCalculator integration', () => {
  it('emits contract-shaped callbacks and transitions from blocked to ready', async () => {
    const onChange = vi.fn();
    const onSave = vi.fn();
    const onExport = vi.fn();

    render(
      <DieCutCalculator
        input={{ initialState: buildReadyStateWithBlockedGeometry() }}
        onChange={onChange}
        onSave={onSave}
        onExport={onExport}
      />
    );

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
    });

    const initialPayload = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0];
    expect(initialPayload).toMatchObject({
      dirty: false,
      blocked: true,
    });
    expect(initialPayload.activeDie).toBeDefined();
    expect(initialPayload.calculation).toBeDefined();
    expect(initialPayload.purchaseSpecification).toBeDefined();
    expect(typeof initialPayload.plainTextSupplierCopy).toBe('string');

    const labelsAroundInput = screen.getByLabelText('Labels around · web direction');
    fireEvent.focus(labelsAroundInput);
    fireEvent.change(labelsAroundInput, { target: { value: '8' } });
    fireEvent.blur(labelsAroundInput);

    await waitFor(() => {
      const latest = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0];
      expect(latest.blocked).toBe(false);
      expect(latest.purchaseSpecification.status).toBe('readyForHumanReview');
      expect(latest.dirty).toBe(true);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onExport).toHaveBeenCalled();
    });

    const savedState = onSave.mock.calls[0][0];
    const exportPayload = onExport.mock.calls[onExport.mock.calls.length - 1]?.[0];
    expect(savedState.activeDieId).toBeDefined();
    expect(exportPayload).toMatchObject({ state: savedState });
    expect(typeof exportPayload.purchaseJson).toBe('string');
    expect(typeof exportPayload.purchaseCsv).toBe('string');
  });
});