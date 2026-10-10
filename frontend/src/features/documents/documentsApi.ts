import { endpoints } from '../../shared/api/endpoints';
import { ApiError } from '../../shared/api/errors';
import { apiRequest, apiRequestBlob } from '../../shared/api/httpClient';
import { isMockApiMode } from '../../shared/api/mode';

import { validateDocumentFile } from './documentValidation';
import { mapBackendDocument } from './mapDocument';

import type {
  BackendDocument,
  BackendDocumentList,
  DocumentDownload,
  DocumentUploadInput,
  FrontendDocument,
} from './documents.types';

const UPLOAD_TIMEOUT_MS = 60_000;

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

interface MockDocument {
  record: BackendDocument;
  file: File;
}

// Mock mode starts empty so the Documents tab keeps its existing empty state.
const mockDocuments: MockDocument[] = [];

export const resetDocumentsMock = (): void => {
  mockDocuments.length = 0;
};

const mockList = (caseId?: string): BackendDocument[] =>
  mockDocuments
    .map((entry) => entry.record)
    .filter((record) => (caseId ? record.caseId === caseId : true));

const listQuery = (caseId?: string): string =>
  caseId ? `?caseId=${encodeURIComponent(caseId)}` : '';

export const getDocuments = async (
  caseId?: string,
): Promise<FrontendDocument[]> => {
  if (isMockApiMode()) {
    await wait(150);
    return mockList(caseId).map(mapBackendDocument);
  }

  const records = await apiRequest<BackendDocumentList>(
    `${endpoints.documents.list}${listQuery(caseId)}`,
  );
  return records.map(mapBackendDocument);
};

export const getDocumentById = async (
  documentId: string,
): Promise<FrontendDocument> => {
  if (isMockApiMode()) {
    await wait(150);
    const entry = mockDocuments.find((item) => item.record.id === documentId);
    if (!entry) {
      throw new ApiError('DOCUMENT_NOT_FOUND', 'The document was not found', 404);
    }
    return mapBackendDocument(entry.record);
  }

  const record = await apiRequest<BackendDocument>(
    endpoints.documents.detail(documentId),
  );
  return mapBackendDocument(record);
};

export const uploadDocument = async ({
  file,
  caseId,
}: DocumentUploadInput): Promise<FrontendDocument> => {
  const validationCode = validateDocumentFile(file);
  if (validationCode) {
    throw new ApiError(validationCode, 'The file was rejected', 400);
  }

  if (isMockApiMode()) {
    await wait(300);
    const record: BackendDocument = {
      id: `doc-${Date.now()}-${mockDocuments.length}`,
      caseId,
      originalName: file.name,
      mimeType: file.type || 'application/pdf',
      size: file.size,
      status: 'UPLOADED',
      isAnalyzed: false,
      createdAt: new Date().toISOString(),
    };
    mockDocuments.push({ record, file });
    return mapBackendDocument(record);
  }

  // The browser must set the multipart boundary, so no Content-Type here.
  const formData = new FormData();
  formData.append('file', file);
  formData.append('caseId', caseId);

  const record = await apiRequest<BackendDocument>(endpoints.documents.upload, {
    method: 'POST',
    body: formData,
    timeoutMs: UPLOAD_TIMEOUT_MS,
  });
  return mapBackendDocument(record);
};

export const downloadDocument = async (
  documentId: string,
  fileName: string,
): Promise<DocumentDownload> => {
  if (isMockApiMode()) {
    await wait(150);
    const entry = mockDocuments.find((item) => item.record.id === documentId);
    if (!entry) {
      throw new ApiError('DOCUMENT_NOT_FOUND', 'The document was not found', 404);
    }
    return { blob: entry.file, fileName: entry.record.originalName };
  }

  const blob = await apiRequestBlob(endpoints.documents.download(documentId));
  return { blob, fileName };
};
