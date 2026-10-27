import { useCallback, useEffect, useMemo, useState } from 'react';

import { ar } from '../../core/i18n/ar';
import { ApiError, getUserFacingAdvisorError, getUserFacingDocumentError } from '../../shared/api/errors';
import { isDomainLive } from '../../shared/api/mode';
import {
  getDocuments,
  uploadDocument as uploadCaseDocument,
} from '../documents/documentsApi';
import { getLegalCases } from '../legal-file/legalFileApi';

import { startDocumentAnalysis } from './advisorApi';
import { saveAdvisorScope } from './advisorSession';

import type { FileKind, UploadedFileItem } from './advisor.types';

interface UseDocumentAnalysisResult {
  files: UploadedFileItem[];
  canAnalyze: boolean;
  isAnalyzing: boolean;
  errorMessage: string | null;
  addFiles: (fileList: File[]) => void;
  removeFile: (id: string) => void;
  startAnalyze: () => Promise<string | null>;
  clearError: () => void;
}

const createId = (): string =>
  `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const detectKind = (name: string, type: string): FileKind => {
  const lower = name.toLowerCase();
  if (type.includes('pdf') || lower.endsWith('.pdf')) return 'pdf';
  if (type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(lower)) {
    return 'image';
  }
  return 'doc';
};

const initialMockFiles = (): UploadedFileItem[] => [
  {
    id: 'mock-pdf',
    name: ar.advisor.upload.mock.pdfName,
    sizeMB: 1.4,
    progress: 100,
    status: 'done',
    kind: 'pdf',
    documentId: 'doc-mock-pdf',
  },
  {
    id: 'mock-image',
    name: ar.advisor.upload.mock.imageName,
    sizeMB: 0.8,
    progress: 68,
    status: 'uploading',
    kind: 'image',
  },
];

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const EXTENDED_INDIC = '۰۱۲۳۴۵۶۷۸۹';

/** Parses an Arabic size label such as `٥.٠ م.ب` without dropping Indic digits. */
export const parseSizeMb = (sizeLabel: string): number => {
  const ascii = sizeLabel
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_INDIC.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(EXTENDED_INDIC.indexOf(digit)));
  const match = ascii.replace(/[^\d.]/g, '');
  const value = Number.parseFloat(match);
  return Number.isFinite(value) && value > 0 ? value : 0.1;
};

export const useDocumentAnalysis = (): UseDocumentAnalysisResult => {
  const live = isDomainLive('advisor');
  const [files, setFiles] = useState<UploadedFileItem[]>(() =>
    live ? [] : initialMockFiles(),
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!live) {
      return undefined;
    }

    let cancelled = false;
    void getDocuments()
      .then((documents) => {
        if (cancelled) {
          return;
        }
        setFiles(
          documents.map((document) => ({
            id: document.id,
            name: document.name,
            sizeMB: parseSizeMb(document.sizeLabel),
            progress: 100,
            status: 'done' as const,
            kind: document.kind,
            documentId: document.id,
            caseId: document.caseId,
            origin: 'library' as const,
          })),
        );
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setErrorMessage(getUserFacingDocumentError(error));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [live]);

  useEffect(() => {
    if (live) {
      return undefined;
    }

    const pending = files.find(
      (file) => file.id === 'mock-image' && file.status === 'uploading',
    );
    if (!pending) {
      return undefined;
    }

    let progress = pending.progress;
    const timer = window.setInterval(() => {
      progress = Math.min(progress + 8, 100);
      setFiles((current) =>
        current.map((file) => {
          if (file.id !== 'mock-image') {
            return file;
          }
          if (progress >= 100) {
            return {
              ...file,
              progress: 100,
              status: 'done',
              documentId: file.documentId ?? 'doc-mock-image',
            };
          }
          return { ...file, progress };
        }),
      );
      if (progress >= 100) {
        window.clearInterval(timer);
      }
    }, 500);

    return () => {
      window.clearInterval(timer);
    };
    // Mock seed animation runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  const addFiles = useCallback(
    (fileList: File[]) => {
      setErrorMessage(null);
      fileList.forEach((file) => {
        const id = createId();
        const sizeMB = Math.round((file.size / (1024 * 1024)) * 10) / 10;
        const kind = detectKind(file.name, file.type);

        setFiles((current) => [
          ...current,
          {
            id,
            name: file.name,
            sizeMB: sizeMB || 0.1,
            progress: 0,
            status: 'uploading',
            kind,
          },
        ]);

        const upload = async (): Promise<{ documentId: string; caseId: string | null }> => {
          if (!isDomainLive('advisor')) {
            for (let percent = 10; percent <= 100; percent += 10) {
              await new Promise<void>((resolve) => {
                window.setTimeout(resolve, 120);
              });
              setFiles((current) =>
                current.map((item) =>
                  item.id === id
                    ? {
                        ...item,
                        progress: percent,
                        status: percent >= 100 ? 'done' : 'uploading',
                      }
                    : item,
                ),
              );
            }
            return { documentId: `doc-${Date.now()}-${file.name}`, caseId: null };
          }

          const cases = await getLegalCases();
          const caseId = cases[0]?.id;
          if (!caseId) {
            throw new ApiError(
              'CASE_NOT_FOUND',
              ar.advisor.upload.noCaseError,
              404,
            );
          }

          setFiles((current) =>
            current.map((item) =>
              item.id === id ? { ...item, progress: 40 } : item,
            ),
          );

          const uploaded = await uploadCaseDocument({
            file,
            caseId,
          });

          setFiles((current) =>
            current.map((item) =>
              item.id === id ? { ...item, progress: 100 } : item,
            ),
          );

          return { documentId: uploaded.id, caseId };
        };

        void upload()
          .then((result) => {
            setFiles((current) =>
              current.map((item) =>
                item.id === id
                  ? {
                      ...item,
                      progress: 100,
                      status: 'done',
                      documentId: result.documentId,
                      caseId: result.caseId,
                      origin: 'session',
                    }
                  : item,
              ),
            );
          })
          .catch((error: unknown) => {
            setFiles((current) =>
              current.map((item) =>
                item.id === id ? { ...item, status: 'error', progress: 0 } : item,
              ),
            );
            if (
              error instanceof ApiError &&
              error.code === 'CASE_NOT_FOUND'
            ) {
              setErrorMessage(ar.advisor.upload.noCaseError);
              return;
            }
            setErrorMessage(getUserFacingDocumentError(error));
          });
      });
    },
    [],
  );

  const removeFile = useCallback((id: string) => {
    setFiles((current) => current.filter((file) => file.id !== id));
  }, []);

  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  const canAnalyze = useMemo(
    () =>
      files.some((file) => file.status === 'done' && Boolean(file.documentId)),
    [files],
  );

  const startAnalyze = useCallback(async (): Promise<string | null> => {
    if (!canAnalyze || isAnalyzing) {
      return null;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);
    try {
      const ready = files.filter(
        (file) => file.status === 'done' && file.documentId,
      );
      const sessionFiles = ready.filter((file) => file.origin === 'session');
      const chosen = sessionFiles.length > 0 ? sessionFiles : ready.slice(0, 1);
      const documentIds = chosen.map((file) => file.documentId as string);
      const caseIds = [
        ...new Set(
          chosen
            .map((file) => file.caseId)
            .filter((caseId): caseId is string => Boolean(caseId)),
        ),
      ];
      const result = await startDocumentAnalysis(documentIds);
      saveAdvisorScope(result.jobId, {
        documentIds,
        caseId: caseIds.length === 1 ? caseIds[0] : undefined,
      });
      return result.jobId;
    } catch (error: unknown) {
      setErrorMessage(getUserFacingAdvisorError(error));
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, [canAnalyze, files, isAnalyzing]);

  return {
    files,
    canAnalyze,
    isAnalyzing,
    errorMessage,
    addFiles,
    removeFile,
    startAnalyze,
    clearError,
  };
};
