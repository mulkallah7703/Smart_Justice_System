import { describe, expect, it } from 'vitest';

import { formatSizeLabel } from '../../shared/components/FileRow';
import { reportHijriDate, mapAnswerToReport } from './mapAdvisor';
import {
  loadAdvisorScope,
  saveAdvisorScope,
} from './advisorSession';
import { parseSizeMb } from './useDocumentAnalysis';
import { buildCreateCaseBody } from '../legal-file/legalFileApi';

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
    expect(loadAdvisorScope('demo')).toEqual({
      documentIds: ['doc-custody'],
      caseId: 'case-custody',
    });
  });
});

describe('parseSizeMb', () => {
  it('keeps Arabic-Indic digits in the size label', () => {
    expect(parseSizeMb('٥.٠ م.ب')).toBe(5);
    expect(parseSizeMb('۰.۸ م.ب')).toBe(0.8);
    expect(parseSizeMb('1.2 MB')).toBe(1.2);
  });

  it('treats a kilobyte label as a fraction of a megabyte', () => {
    expect(parseSizeMb('270 ك.ب')).toBeCloseTo(270 / 1024);
    expect(parseSizeMb('٢٧٠ ك.ب')).toBeCloseTo(270 / 1024);
    expect(formatSizeLabel(parseSizeMb('270 ك.ب'))).toBe('270 ك.ب');
    expect(formatSizeLabel(1.4)).toBe('1.4 م.ب');
  });
});

describe('report date and case form', () => {
  it('uses a Hijri date written in the analysis', () => {
    expect(reportHijriDate('صدر في 12 ربيع الأول 1447')).toBe('12 ربيع الأول 1447');
    const report = mapAnswerToReport(
      'job-1',
      { answer: 'آخر سؤال', claims: [], insufficientEvidence: false },
      'ملخص الحكم: حضانة الأب.',
    );
    expect(report.sections[0]?.body).toContain('حضانة الأب');
    expect(report.sections.map((section) => section.id)).toContain('answer');
    expect(report.dateHijri).not.toBe('١٤٤٦/٠٨/٢٧هـ');
  });

  it('posts authority and objection days with the case type', () => {
    expect(
      buildCreateCaseBody({
        type: 'CRIMINAL',
        authority: 'المحكمة الجزائية',
        objectionDays: 30,
      }),
    ).toEqual({
      type: 'CRIMINAL',
      authority: 'المحكمة الجزائية',
      objectionDays: 30,
    });
    expect(buildCreateCaseBody({ type: 'PERSONAL', authority: ' ' })).toEqual({
      type: 'PERSONAL',
    });
  });
});
