import { ar } from '../../core/i18n/ar';
import { endpoints } from '../../shared/api/endpoints';
import { ApiError } from '../../shared/api/errors';
import { apiRequest } from '../../shared/api/httpClient';
import { isMockApiMode } from '../../shared/api/mode';

import type {
  BackendCase,
  BackendCaseDetail,
  BackendCaseType,
  FrontendCase,
  FrontendCaseDetail,
} from './cases.types';
import { mapBackendCase, mapBackendCaseDetail } from './mapCase';

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

const mockCases = (): FrontendCase[] => [
  {
    id: 'case-1',
    title: ar.legalFile.cases.rental.title,
    subtitle: ar.legalFile.cases.rental.subtitle,
    caseNumber: 'رقم ٣٢٠١-١٤٤٦',
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
    caseNumber: 'رقم ٩٩٢٠-١٤٤٥',
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

const mockCaseDetails = (): Record<string, FrontendCaseDetail> => {
  const [rental, commercial] = mockCases();
  return {
    'case-1': {
      ...rental,
      notes: null,
      hearings: [
        {
          id: 'hearing-1',
          scheduledAtLabel: rental.footer?.text ?? '',
          location: 'لجنة المنازعات الإيجارية',
        },
      ],
      deadlines: [
        {
          id: 'deadline-1',
          type: 'APPEAL',
          dueAtLabel: rental.footer?.text ?? '',
          label: rental.footer?.text ?? '',
        },
      ],
    },
    'case-2': {
      ...commercial,
      notes: null,
      hearings: [],
      deadlines: [],
    },
  };
};

export const buildCreateCaseBody = (input: {
  type: BackendCaseType;
  authority?: string;
  objectionDays?: number;
}): { type: BackendCaseType; authority?: string; objectionDays?: number } => {
  const authority = input.authority?.trim();
  const days = input.objectionDays;
  return {
    type: input.type,
    ...(authority && authority.length >= 2 ? { authority } : {}),
    ...(typeof days === 'number' && days >= 1 && days <= 365
      ? { objectionDays: days }
      : {}),
  };
};

export const createLegalCase = async (input: {
  type: BackendCaseType;
  authority?: string;
  objectionDays?: number;
}): Promise<FrontendCaseDetail> => {
  if (isMockApiMode()) {
    await wait(200);
    return {
      id: `case-${Date.now()}`,
      title: ar.legalFile.caseTypes[input.type],
      subtitle: '',
      caseNumber: '',
      status: ar.legalFile.caseStatus.PENDING,
      statusVariant: 'pending',
      accent: 'warning',
      footer: null,
      notes: null,
      hearings: [],
      deadlines: [],
    };
  }

  const record = await apiRequest<BackendCaseDetail>(endpoints.legalFile.cases, {
    method: 'POST',
    body: buildCreateCaseBody(input),
  });
  return mapBackendCaseDetail(record);
};

export const getLegalCases = async (): Promise<FrontendCase[]> => {
  if (isMockApiMode()) {
    await wait(200);
    return mockCases();
  }

  const records = await apiRequest<BackendCase[]>(endpoints.legalFile.cases);
  return records.map(mapBackendCase);
};

export const getLegalCaseById = async (
  caseId: string,
): Promise<FrontendCaseDetail> => {
  if (isMockApiMode()) {
    await wait(200);
    const detail = mockCaseDetails()[caseId];
    if (!detail) {
      throw new ApiError('CASE_NOT_FOUND', 'The case was not found', 404);
    }
    return detail;
  }

  const record = await apiRequest<BackendCaseDetail>(
    endpoints.legalFile.case(caseId),
  );
  return mapBackendCaseDetail(record);
};
