import { describe, expect, it } from 'vitest';

import { ar } from '../../core/i18n/ar';

import {
  formatFileSizeAr,
  mapBackendDocument,
  mapDocumentKind,
  mapDocumentStatus,
} from './mapDocument';

import type { BackendDocument } from './documents.types';

const record = (overrides: Partial<BackendDocument> = {}): BackendDocument => ({
  id: 'doc_1',
  caseId: 'case_1',
  originalName: 'lease.pdf',
  mimeType: 'application/pdf',
  size: 245678,
  status: 'UPLOADED',
  isAnalyzed: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('mapDocument', () => {
  it('maps backend statuses to existing badge variants', () => {
    expect(mapDocumentStatus('UPLOADED')).toEqual({
      label: ar.documents.status.UPLOADED,
      statusVariant: 'pending',
    });
    expect(mapDocumentStatus('READY').statusVariant).toBe('active');
    expect(mapDocumentStatus('REJECTED').statusVariant).toBe('closed');
  });

  it('maps MIME types to document kinds', () => {
    expect(mapDocumentKind('application/pdf')).toBe('pdf');
    expect(mapDocumentKind('image/jpeg')).toBe('image');
    expect(mapDocumentKind('image/png')).toBe('image');
    expect(mapDocumentKind('application/msword')).toBe('doc');
  });

  it('formats sizes with Arabic numerals', () => {
    expect(formatFileSizeAr(512)).toBe('٥١٢ بايت');
    expect(formatFileSizeAr(2048)).toBe('٢.٠ ك.ب');
    expect(formatFileSizeAr(245678)).toContain('ك.ب');
    expect(formatFileSizeAr(5 * 1024 * 1024)).toBe('٥.٠ م.ب');
  });

  it('maps a backend document into the UI model', () => {
    const mapped = mapBackendDocument(record());

    expect(mapped.id).toBe('doc_1');
    expect(mapped.caseId).toBe('case_1');
    expect(mapped.name).toBe('lease.pdf');
    expect(mapped.kind).toBe('pdf');
    expect(mapped.statusLabel).toBe(ar.documents.status.UPLOADED);
    expect(mapped.isAnalyzed).toBe(false);
    expect(mapped.createdAtLabel).not.toBe('');
    expect(mapped).not.toHaveProperty('mimeType');
    expect(mapped).not.toHaveProperty('size');
  });

  it('keeps isAnalyzed and a null caseId from the backend', () => {
    const mapped = mapBackendDocument(
      record({ caseId: null, isAnalyzed: true, status: 'READY' }),
    );

    expect(mapped.caseId).toBeNull();
    expect(mapped.isAnalyzed).toBe(true);
    expect(mapped.statusLabel).toBe(ar.documents.status.READY);
  });
});
