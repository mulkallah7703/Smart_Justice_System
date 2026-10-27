import { describe, expect, it } from 'vitest';

import { loadAdvisorScope, saveAdvisorScope } from './advisorSession';
import { parseSizeMb } from './useDocumentAnalysis';

describe('advisor document scope', () => {
  it('stores the case and documents chosen for one analysis job', () => {
    saveAdvisorScope('job-1', {
      documentIds: ['doc-custody'],
      caseId: 'case-custody',
    });
    expect(loadAdvisorScope('job-1')).toEqual({
      documentIds: ['doc-custody'],
      caseId: 'case-custody',
    });
    expect(loadAdvisorScope('missing')).toBeNull();
  });
});

describe('parseSizeMb', () => {
  it('keeps Arabic-Indic digits in the size label', () => {
    expect(parseSizeMb('٥.٠ م.ب')).toBe(5);
    expect(parseSizeMb('۰.۸ م.ب')).toBe(0.8);
    expect(parseSizeMb('1.2 MB')).toBe(1.2);
  });
});
