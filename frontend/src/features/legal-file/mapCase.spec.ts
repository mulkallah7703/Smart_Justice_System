import { describe, expect, it } from 'vitest';

import { ar } from '../../core/i18n/ar';
import { formatDateAr, formatDateTimeAr } from '../../shared/utils/dateFormatter';

import type { BackendCase, BackendCaseDetail } from './cases.types';
import {
  mapBackendCase,
  mapBackendCaseDetail,
  mapCaseStatus,
  mapCaseType,
  mapDeadline,
  mapHearing,
} from './mapCase';

const listCase: BackendCase = {
  id: 'case_1',
  caseNumber: 'DEV-CASE-0001',
  type: 'RENTAL',
  status: 'ACTIVE',
  authority: 'DEV Commercial Court',
  createdAt: '2026-01-01T00:00:00.000Z',
  nextHearing: {
    id: 'h1',
    scheduledAt: '2030-01-15T09:00:00.000Z',
    location: 'Room 1',
  },
  nextDeadline: {
    id: 'd1',
    type: 'DOCUMENT_SUBMIT',
    dueAt: '2030-01-10T21:00:00.000Z',
    label: 'Submit docs',
  },
};

describe('case status mapping', () => {
  it('maps every backend status onto an existing badge variant', () => {
    expect(mapCaseStatus('PENDING')).toEqual({
      label: ar.legalFile.caseStatus.PENDING,
      statusVariant: 'pending',
    });
    expect(mapCaseStatus('ACTIVE')).toEqual({
      label: ar.legalFile.caseStatus.ACTIVE,
      statusVariant: 'active',
    });
    expect(mapCaseStatus('CLOSED')).toEqual({
      label: ar.legalFile.caseStatus.CLOSED,
      statusVariant: 'closed',
    });
    expect(mapCaseStatus('APPEALING')).toEqual({
      label: ar.legalFile.caseStatus.APPEALING,
      statusVariant: 'appeal',
    });
  });
});

describe('case type mapping', () => {
  it('maps every backend type to existing Arabic terminology', () => {
    expect(mapCaseType('RENTAL')).toBe(ar.legalFile.caseTypes.RENTAL);
    expect(mapCaseType('COMMERCIAL')).toBe(ar.legalFile.caseTypes.COMMERCIAL);
    expect(mapCaseType('PERSONAL')).toBe(ar.legalFile.caseTypes.PERSONAL);
    expect(mapCaseType('LABOR')).toBe(ar.legalFile.caseTypes.LABOR);
  });
});

describe('mapBackendCase', () => {
  it('maps a backend list item onto the Legal File card model', () => {
    const mapped = mapBackendCase(listCase);

    expect(mapped.id).toBe('case_1');
    expect(mapped.title).toBe(ar.legalFile.caseTypes.RENTAL);
    expect(mapped.status).toBe(ar.legalFile.caseStatus.ACTIVE);
    expect(mapped.statusVariant).toBe('active');
    expect(mapped.accent).toBe('success');
    expect(mapped.subtitle).toContain('DEV');
    expect(mapped.footer?.icon).toBe('schedule');
    expect(mapped.footer?.text).toContain('Submit docs');
    expect(mapped).not.toHaveProperty('userId');
    expect(mapped).not.toHaveProperty('lawyerId');
    expect(JSON.stringify(mapped)).not.toMatch(/PENDING|ACTIVE|RENTAL/);
  });
});

describe('hearings and deadlines', () => {
  it('formats hearing and deadline dates for the existing UI', () => {
    const hearing = mapHearing({
      id: 'h1',
      scheduledAt: '2030-01-15T09:00:00.000Z',
      location: 'Room 1',
      notes: 'internal',
    });
    const deadline = mapDeadline({
      id: 'd1',
      type: 'APPEAL',
      dueAt: '2030-01-10T21:00:00.000Z',
      label: 'Appeal window',
    });

    expect(hearing.scheduledAtLabel).toBe(
      formatDateTimeAr('2030-01-15T09:00:00.000Z'),
    );
    expect(hearing.location).toBe('Room 1');
    expect(hearing).not.toHaveProperty('notes');
    expect(deadline.dueAtLabel).toBe(formatDateAr('2030-01-10T21:00:00.000Z'));
    expect(deadline.label).toBe('Appeal window');
  });
});

describe('mapBackendCaseDetail', () => {
  it('maps hearings and deadlines without exposing backend DTO fields', () => {
    const detail: BackendCaseDetail = {
      id: 'case_1',
      caseNumber: 'DEV-CASE-0001',
      type: 'RENTAL',
      status: 'PENDING',
      authority: 'DEV Court',
      notes: 'Seed notes',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      hearings: [
        {
          id: 'h1',
          scheduledAt: '2030-01-15T09:00:00.000Z',
          location: 'Room 1',
          notes: 'Bring ID',
        },
      ],
      deadlines: [
        {
          id: 'd1',
          type: 'APPEAL',
          dueAt: '2030-01-10T21:00:00.000Z',
          label: 'Appeal',
        },
      ],
    };

    const mapped = mapBackendCaseDetail(detail);
    expect(mapped.hearings).toHaveLength(1);
    expect(mapped.deadlines).toHaveLength(1);
    expect(mapped.notes).toBe('Seed notes');
    expect(mapped).not.toHaveProperty('userId');
    expect(mapped).not.toHaveProperty('createdAt');
    expect(mapped).not.toHaveProperty('updatedAt');
    expect(mapped.hearings[0]).not.toHaveProperty('scheduledAt');
    expect(mapped.deadlines[0]).not.toHaveProperty('dueAt');
  });
});
