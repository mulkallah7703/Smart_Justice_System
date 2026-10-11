import { describe, expect, it } from 'vitest';

import type { Alert } from '../alerts/alerts.types';

import { selectHomeAlert } from './selectHomeAlert';

const alert = (overrides: Partial<Alert> = {}): Alert => ({
  id: 'alert_1',
  type: 'DEADLINE',
  severity: 'URGENT',
  titleAr: 'قرب انتهاء مهلة',
  bodyAr: 'تذكير بمهلة حقيقية',
  icon: 'error',
  isRead: false,
  triggeredAt: '2030-01-01T10:00:00.000Z',
  ...overrides,
});

describe('selectHomeAlert', () => {
  it('returns null for an empty alert collection', () => {
    expect(selectHomeAlert([])).toBeNull();
  });

  it('uses the genuine alert title and body', () => {
    expect(selectHomeAlert([alert()])).toEqual({
      id: 'alert_1',
      title: 'قرب انتهاء مهلة',
      subtitle: 'تذكير بمهلة حقيقية',
    });
  });

  it('prefers an unread URGENT alert over a newer WARNING alert', () => {
    const selected = selectHomeAlert([
      alert({ id: 'warning', severity: 'WARNING', titleAr: 'مستند ناقص' }),
      alert({ id: 'urgent', severity: 'URGENT', titleAr: 'مهلة عاجلة' }),
    ]);
    expect(selected?.id).toBe('urgent');
  });

  it('keeps API order (newest first) between alerts of equal severity', () => {
    const selected = selectHomeAlert([
      alert({ id: 'newest' }),
      alert({ id: 'older' }),
    ]);
    expect(selected?.id).toBe('newest');
  });

  it('falls back to an unread WARNING alert when no URGENT alert exists', () => {
    expect(
      selectHomeAlert([alert({ id: 'warning', severity: 'WARNING' })])?.id,
    ).toBe('warning');
  });

  it('ignores read alerts and INFO alerts', () => {
    expect(
      selectHomeAlert([
        alert({ id: 'read', isRead: true }),
        alert({ id: 'info', severity: 'INFO', type: 'LAW_UPDATE' }),
      ]),
    ).toBeNull();
  });
});
