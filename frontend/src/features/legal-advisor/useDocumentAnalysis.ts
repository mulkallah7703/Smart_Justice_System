import { useCallback, useEffect, useMemo, useState } from 'react';

import { ar } from '../../core/i18n/ar';

import { startDocumentAnalysis, uploadDocument } from './advisorApi';

import type { FileKind, UploadedFileItem } from './advisor.types';

interface UseDocumentAnalysisResult {
  files: UploadedFileItem[];
  canAnalyze: boolean;
  isAnalyzing: boolean;
  addFiles: (fileList: File[]) => void;
  removeFile: (id: string) => void;
  startAnalyze: () => Promise<string | null>;
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

export const useDocumentAnalysis = (): UseDocumentAnalysisResult => {
  const [files, setFiles] = useState<UploadedFileItem[]>(initialMockFiles);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
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
  }, []);

  const addFiles = useCallback((fileList: File[]) => {
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

      void uploadDocument(file, (percent) => {
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
      })
        .then((result) => {
          setFiles((current) =>
            current.map((item) =>
              item.id === id
                ? {
                    ...item,
                    progress: 100,
                    status: 'done',
                    documentId: result.documentId,
                  }
                : item,
            ),
          );
        })
        .catch(() => {
          setFiles((current) =>
            current.map((item) =>
              item.id === id ? { ...item, status: 'error', progress: 0 } : item,
            ),
          );
        });
    });
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((current) => current.filter((file) => file.id !== id));
  }, []);

  const canAnalyze = useMemo(
    () => files.some((file) => file.status === 'done'),
    [files],
  );

  const startAnalyze = useCallback(async (): Promise<string | null> => {
    if (!canAnalyze || isAnalyzing) {
      return null;
    }

    setIsAnalyzing(true);
    try {
      const documentIds = files
        .filter((file) => file.status === 'done' && file.documentId)
        .map((file) => file.documentId as string);
      const result = await startDocumentAnalysis(documentIds);
      return result.jobId;
    } catch {
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, [canAnalyze, files, isAnalyzing]);

  return {
    files,
    canAnalyze,
    isAnalyzing,
    addFiles,
    removeFile,
    startAnalyze,
  };
};
