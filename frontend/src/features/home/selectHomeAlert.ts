import type { Alert, AlertSeverity } from '../alerts/alerts.types';

import type { HomeAlert } from './home.types';

/** The home banner is styled as a danger warning, so INFO alerts are not promoted to it. */
const BANNER_SEVERITY_RANK: Partial<Record<AlertSeverity, number>> = {
  URGENT: 0,
  WARNING: 1,
};

/**
 * Picks the genuine alert shown in the home banner, or null when none qualifies.
 * Among unread URGENT/WARNING alerts, URGENT wins; ties keep the API order (newest first).
 */
export const selectHomeAlert = (alerts: readonly Alert[]): HomeAlert | null => {
  let selected: Alert | null = null;
  let selectedRank = Number.POSITIVE_INFINITY;

  for (const alert of alerts) {
    const rank = BANNER_SEVERITY_RANK[alert.severity];
    if (alert.isRead || rank === undefined || rank >= selectedRank) {
      continue;
    }
    selected = alert;
    selectedRank = rank;
  }

  return selected
    ? { id: selected.id, title: selected.titleAr, subtitle: selected.bodyAr }
    : null;
};
