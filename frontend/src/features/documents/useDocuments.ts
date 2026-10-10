import { useCallback, useEffect, useState } from 'react';

import { getUserFacingDocumentError } from '../../shared/api/errors';

import { downloadDocument, getDocuments, uploadDocument } from './documentsApi';
import { saveBlob } from './saveBlob';

import type { FrontendDocument } from './documents.types';

interface UseDocumentsResult {
  documents: FrontendDocument[];
  isLoading: boolean;
  isUploading: boolean;
  downloadingId: string | null;
  errorMessage: string | null;
  upload: (file: File) => Promise<void>;
  download: (document: FrontendDocument) => Promise<void>;
}

export const useDocuments = (caseId?: string): UseDocumentsResult => {
  const [documents, setDocuments] = useState<FrontendDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async (): Promise<void> => {
      setIsLoading(true);
      setErrorMessage(null);
      // Drop the previous case's documents so nothing stale is rendered.
      setDocuments([]);
      try {
        const data = await getDocuments(caseId);
        if (active) {
          setDocuments(data);
        }
      } catch (error) {
        if (active) {
          setDocuments([]);
          setErrorMessage(getUserFacingDocumentError(error));
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [caseId]);

  const upload = useCallback(
    async (file: File): Promise<void> => {
      if (!caseId || isUploading) {
        return;
      }

      setIsUploading(true);
      setErrorMessage(null);
      try {
        const created = await uploadDocument({ file, caseId });
        setDocuments((current) => [created, ...current]);
      } catch (error) {
        setErrorMessage(getUserFacingDocumentError(error));
      } finally {
        setIsUploading(false);
      }
    },
    [caseId, isUploading],
  );

  const download = useCallback(
    async (item: FrontendDocument): Promise<void> => {
      setDownloadingId(item.id);
      setErrorMessage(null);
      try {
        const file = await downloadDocument(item.id, item.name);
        saveBlob(file.blob, file.fileName);
      } catch (error) {
        setErrorMessage(getUserFacingDocumentError(error));
      } finally {
        setDownloadingId(null);
      }
    },
    [],
  );

  return {
    documents,
    isLoading,
    isUploading,
    downloadingId,
    errorMessage,
    upload,
    download,
  };
};
