import { ar } from '../../core/i18n/ar';
import { endpoints } from '../../shared/api/endpoints';

import type { LegalCase } from './legalFile.types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

export const getLegalCases = async (): Promise<LegalCase[]> => {
  if (!API_BASE_URL) {
    await wait(200);
    return [
      {
        id: 'case-1',
        title: ar.legalFile.cases.rental.title,
        subtitle: ar.legalFile.cases.rental.subtitle,
        status: ar.legalFile.cases.rental.status,
        statusVariant: 'pending',
        accent: 'warning',
        footer: {
          tone: 'danger',
          icon: 'schedule',
          text: ar.legalFile.cases.rental.footer,
        },
      },
      {
        id: 'case-2',
        title: ar.legalFile.cases.commercial.title,
        subtitle: ar.legalFile.cases.commercial.subtitle,
        status: ar.legalFile.cases.commercial.status,
        statusVariant: 'active',
        accent: 'success',
        footer: {
          tone: 'success',
          icon: 'check_circle',
          text: ar.legalFile.cases.commercial.footer,
        },
      },
    ];
  }

  const response = await fetch(`${API_BASE_URL}${endpoints.legalFile.cases}`);

  if (!response.ok) {
    throw new Error('LEGAL_CASES_FAILED');
  }

  const json = (await response.json()) as { data: LegalCase[] };
  return json.data;
};
